import { DomConfig, DomRecordingEvent, SerializedNode } from '../types';
import { 
  createSerializationContext, 
  isInputMasked,
  isTextMasked,
  maskString, 
  SerializationContext, 
  serializeNode, 
  shouldIgnoreNode 
} from './serializer';

export interface DomRecorderOptions {
  config?: DomConfig;
  timeslice?: number;
  onChunk?: (events: DomRecordingEvent[]) => void;
}

export class DomRecorder {
  private ctx: SerializationContext;
  private observer?: MutationObserver;
  private events: DomRecordingEvent[] = [];
  private pendingChunkEvents: DomRecordingEvent[] = [];
  private startTime = 0;
  private isRecording = false;
  private isPaused = false;
  private timesliceTimer?: number;
  private lastMouseMoveTime = 0;
  private lastScrollTime = 0;
  private cleanupFns: Array<() => void> = [];

  constructor(private options: DomRecorderOptions = {}) {
    this.ctx = createSerializationContext(options.config);
  }

  start(): DomRecordingEvent[] {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return [];
    }

    this.isRecording = true;
    this.isPaused = false;
    this.startTime = performance.now();
    this.events = [];
    this.pendingChunkEvents = [];

    // 1. Initial Document Snapshot
    const rootSnapshot = serializeNode(document.documentElement, this.ctx);
    if (rootSnapshot) {
      const initialEvent: DomRecordingEvent = {
        type: 'dom_snapshot',
        timestamp: 0,
        data: rootSnapshot,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX || 0,
          scrollY: window.scrollY || 0
        }
      };
      this.pushEvent(initialEvent);
    }

    // 2. Setup Mutation Observer
    this.setupMutationObserver();

    // 3. Setup User Interaction Listeners
    this.setupEventListeners();

    // 4. Setup Timeslice Buffering (for IndexedDB streaming)
    if (this.options.timeslice && this.options.timeslice > 0 && this.options.onChunk) {
      this.timesliceTimer = window.setInterval(() => {
        this.flushPendingChunk();
      }, this.options.timeslice);
    }

    return this.events;
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  stop(): DomRecordingEvent[] {
    this.isRecording = false;
    this.isPaused = false;

    // Disconnect observer
    if (this.observer) {
      this.observer.disconnect();
      this.observer = undefined;
    }

    // Clear timeslice timer
    if (this.timesliceTimer !== undefined) {
      clearInterval(this.timesliceTimer);
      this.timesliceTimer = undefined;
    }

    // Remove all event listeners
    this.cleanupFns.forEach(fn => fn());
    this.cleanupFns = [];

    // Flush any remaining chunk
    this.flushPendingChunk();

    return [...this.events];
  }

  getEvents(): DomRecordingEvent[] {
    return [...this.events];
  }

  private pushEvent(event: DomRecordingEvent): void {
    if (!this.isRecording || this.isPaused) return;
    this.events.push(event);
    this.pendingChunkEvents.push(event);
  }

  private flushPendingChunk(): void {
    if (this.pendingChunkEvents.length > 0 && this.options.onChunk) {
      const chunk = [...this.pendingChunkEvents];
      this.pendingChunkEvents = [];
      this.options.onChunk(chunk);
    }
  }

  private getRelativeTime(): number {
    return Math.max(0, Math.round(performance.now() - this.startTime));
  }

  private setupMutationObserver(): void {
    if (typeof MutationObserver === 'undefined') return;

    this.observer = new MutationObserver((mutations) => {
      if (!this.isRecording || this.isPaused) return;

      const addedNodesList: { parentId: number; nextSiblingId?: number | null; node: SerializedNode }[] = [];
      const removedNodeIds: number[] = [];
      const attributeChanges: { nodeId: number; name: string; value: string | null }[] = [];
      const textChanges: { nodeId: number; value: string }[] = [];

      for (const m of mutations) {
        if (shouldIgnoreNode(m.target, this.ctx)) continue;

        if (m.type === 'childList') {
          const parentId = this.ctx.nodeToId.get(m.target);
          if (parentId !== undefined) {
            // Added nodes
            for (let i = 0; i < m.addedNodes.length; i++) {
              const node = m.addedNodes[i];
              if (shouldIgnoreNode(node, this.ctx)) continue;
              const serialized = serializeNode(node, this.ctx);
              if (serialized) {
                const nextSibling = m.nextSibling ? this.ctx.nodeToId.get(m.nextSibling) ?? null : null;
                addedNodesList.push({
                  parentId,
                  nextSiblingId: nextSibling,
                  node: serialized
                });
              }
            }

            // Removed nodes
            for (let i = 0; i < m.removedNodes.length; i++) {
              const node = m.removedNodes[i];
              const removedId = this.ctx.nodeToId.get(node);
              if (removedId !== undefined) {
                removedNodeIds.push(removedId);
                this.ctx.nodeToId.delete(node);
                this.ctx.idToNode.delete(removedId);
              }
            }
          }
        } else if (m.type === 'attributes') {
          const targetId = this.ctx.nodeToId.get(m.target);
          if (targetId !== undefined && m.attributeName) {
            const el = m.target as Element;
            const val = el.getAttribute(m.attributeName);
            attributeChanges.push({
              nodeId: targetId,
              name: m.attributeName,
              value: val
            });
          }
        } else if (m.type === 'characterData') {
          const targetId = this.ctx.nodeToId.get(m.target);
          if (targetId !== undefined) {
            let val = m.target.textContent || '';
            if (isTextMasked(m.target.parentElement, this.ctx)) {
              val = maskString(val);
            }
            textChanges.push({
              nodeId: targetId,
              value: val
            });
          }
        }
      }

      if (
        addedNodesList.length > 0 || 
        removedNodeIds.length > 0 || 
        attributeChanges.length > 0 || 
        textChanges.length > 0
      ) {
        this.pushEvent({
          type: 'mutation',
          timestamp: this.getRelativeTime(),
          addedNodes: addedNodesList.length > 0 ? addedNodesList : undefined,
          removedNodeIds: removedNodeIds.length > 0 ? removedNodeIds : undefined,
          attributeChanges: attributeChanges.length > 0 ? attributeChanges : undefined,
          textChanges: textChanges.length > 0 ? textChanges : undefined
        });
      }
    });

    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
  }

  private setupEventListeners(): void {
    const mouseThrottle = this.ctx.config.mouseThrottleMs ?? 50;

    // Mouse Move
    if (this.ctx.config.recordMouse !== false) {
      const handleMouseMove = (e: MouseEvent) => {
        const now = performance.now();
        if (now - this.lastMouseMoveTime < mouseThrottle) return;
        this.lastMouseMoveTime = now;

        this.pushEvent({
          type: 'mouse_move',
          timestamp: this.getRelativeTime(),
          x: e.clientX,
          y: e.clientY
        });
      };
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      this.cleanupFns.push(() => window.removeEventListener('mousemove', handleMouseMove));
    }

    // Mouse Clicks
    const handleMouseClick = (type: 'click' | 'mousedown' | 'mouseup') => (e: MouseEvent) => {
      this.pushEvent({
        type: 'mouse_click',
        timestamp: this.getRelativeTime(),
        x: e.clientX,
        y: e.clientY,
        clickType: type
      });
    };
    const clickHandler = handleMouseClick('click');
    window.addEventListener('click', clickHandler, { passive: true, capture: true });
    this.cleanupFns.push(() => window.removeEventListener('click', clickHandler, true));

    // Scroll
    const handleScroll = () => {
      const now = performance.now();
      if (now - this.lastScrollTime < 40) return;
      this.lastScrollTime = now;

      this.pushEvent({
        type: 'scroll',
        timestamp: this.getRelativeTime(),
        x: window.scrollX || window.pageXOffset || 0,
        y: window.scrollY || window.pageYOffset || 0
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    this.cleanupFns.push(() => window.removeEventListener('scroll', handleScroll));

    // Form Inputs & Select Controls
    const handleInput = (e: Event) => {
      let target = e.target as HTMLElement;
      if (!target || shouldIgnoreNode(target, this.ctx)) return;

      if (target instanceof HTMLOptionElement && target.parentElement instanceof HTMLSelectElement) {
        target = target.parentElement;
      }

      const targetId = this.ctx.nodeToId.get(target);
      if (targetId === undefined) return;

      const isMasked = isInputMasked(target, this.ctx);

      if (target instanceof HTMLInputElement) {
        if (target.type === 'checkbox' || target.type === 'radio') {
          this.pushEvent({
            type: 'input',
            timestamp: this.getRelativeTime(),
            targetId,
            value: target.checked,
            checked: target.checked
          });
        } else {
          const val = isMasked ? '••••••••' : target.value;
          this.pushEvent({
            type: 'input',
            timestamp: this.getRelativeTime(),
            targetId,
            value: val
          });
        }
      } else if (target instanceof HTMLSelectElement) {
        const val = isMasked ? '' : target.value;
        this.pushEvent({
          type: 'input',
          timestamp: this.getRelativeTime(),
          targetId,
          value: val,
          selectedIndex: isMasked ? -1 : target.selectedIndex
        });
      } else if (target instanceof HTMLTextAreaElement) {
        const val = isMasked ? '••••••••' : target.value;
        this.pushEvent({
          type: 'input',
          timestamp: this.getRelativeTime(),
          targetId,
          value: val
        });
      }
    };
    window.addEventListener('input', handleInput, { passive: true, capture: true });
    window.addEventListener('change', handleInput, { passive: true, capture: true });
    window.addEventListener('select', handleInput, { passive: true, capture: true });
    this.cleanupFns.push(() => window.removeEventListener('input', handleInput, true));
    this.cleanupFns.push(() => window.removeEventListener('change', handleInput, true));
    this.cleanupFns.push(() => window.removeEventListener('select', handleInput, true));

    // Text Selection Tracking
    let lastSelectionTimeout: number | undefined;
    const handleSelectionChange = () => {
      if (typeof window === 'undefined') return;
      if (lastSelectionTimeout !== undefined) {
        window.clearTimeout(lastSelectionTimeout);
      }
      lastSelectionTimeout = window.setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
          return;
        }

        const ranges: { startNodeId: number; startOffset: number; endNodeId: number; endOffset: number }[] = [];
        for (let i = 0; i < sel.rangeCount; i++) {
          const r = sel.getRangeAt(i);
          const startId = this.ctx.nodeToId.get(r.startContainer);
          const endId = this.ctx.nodeToId.get(r.endContainer);
          if (startId !== undefined && endId !== undefined) {
            ranges.push({
              startNodeId: startId,
              startOffset: r.startOffset,
              endNodeId: endId,
              endOffset: r.endOffset
            });
          }
        }

        if (ranges.length > 0) {
          this.pushEvent({
            type: 'selection',
            timestamp: this.getRelativeTime(),
            ranges
          });
        }
      }, 50);
    };
    document.addEventListener('selectionchange', handleSelectionChange, { passive: true });
    this.cleanupFns.push(() => {
      if (lastSelectionTimeout !== undefined) clearTimeout(lastSelectionTimeout);
      document.removeEventListener('selectionchange', handleSelectionChange);
    });

    // Viewport Resize
    const handleResize = () => {
      this.pushEvent({
        type: 'resize',
        timestamp: this.getRelativeTime(),
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    window.addEventListener('resize', handleResize, { passive: true });
    this.cleanupFns.push(() => window.removeEventListener('resize', handleResize));
  }

  recordCameraPosition(state: { x: number; y: number; width: number; height: number; shape: 'circle' | 'rect'; isMuted?: boolean }): void {
    if (this.isPaused) return;
    this.pushEvent({
      type: 'camera_position',
      timestamp: this.getRelativeTime(),
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height,
      shape: state.shape,
      isMuted: state.isMuted
    });
  }
}
