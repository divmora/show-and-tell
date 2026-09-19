import { DomConfig, DomRecordingEvent, IframeBridgeMessage, SerializedNode } from '../types';
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
  private iframeTrackers = new Map<HTMLIFrameElement, {
    observer?: MutationObserver;
    cleanupFns: Array<() => void>;
  }>();
  private bridgedIframes = new Map<Window, HTMLIFrameElement>();

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

    // 3. Setup Same-Origin Iframes Observation
    if (this.ctx.config.recordIframes !== false) {
      this.scanAndObserveIframes(document);
    }

    // 4. Setup Cross-Origin Iframe Bridge Listener
    if (this.ctx.config.recordCrossOriginIframes !== false) {
      this.setupIframeBridgeListener();
    }

    // 5. Setup User Interaction Listeners
    this.setupEventListeners();

    // 6. Setup Timeslice Buffering (for IndexedDB streaming)
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

    // Disconnect all child iframe observers and event listeners
    this.clearIframeTrackers();

    // Notify bridged cross-origin iframes to stop recording
    this.bridgedIframes.forEach((_iframe, win) => {
      try {
        win.postMessage({ type: 'sat:stop' } as IframeBridgeMessage, '*');
      } catch {}
    });
    this.bridgedIframes.clear();

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
      this.handleMutations(mutations);
    });

    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
  }

  private handleMutations(mutations: MutationRecord[]): void {
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

            // Track any new same-origin iframes added to the DOM
            if (this.ctx.config.recordIframes !== false) {
              if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName.toLowerCase() === 'iframe') {
                this.observeIframe(node as HTMLIFrameElement);
              } else if (node.nodeType === Node.ELEMENT_NODE) {
                this.scanAndObserveIframes(node as Element);
              }
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

            // Clean up trackers for removed iframes
            if (this.ctx.config.recordIframes !== false) {
              if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName.toLowerCase() === 'iframe') {
                this.unobserveIframe(node as HTMLIFrameElement);
              } else if (node.nodeType === Node.ELEMENT_NODE) {
                try {
                  (node as Element).querySelectorAll?.('iframe').forEach(frame => this.unobserveIframe(frame));
                } catch {}
              }
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
  }

  private scanAndObserveIframes(root: Document | Element): void {
    try {
      const iframes = root.querySelectorAll('iframe');
      for (let i = 0; i < iframes.length; i++) {
        this.observeIframe(iframes[i]);
      }
    } catch {}
  }

  private observeIframe(iframeEl: HTMLIFrameElement): void {
    if (this.iframeTrackers.has(iframeEl)) return;
    if (shouldIgnoreNode(iframeEl, this.ctx)) return;

    const cleanupFns: Array<() => void> = [];
    let childObserver: MutationObserver | undefined;

    // Handle iframe reload / dynamic src navigation
    const handleLoad = () => {
      this.unobserveIframe(iframeEl);
      this.observeIframe(iframeEl);
    };
    iframeEl.addEventListener('load', handleLoad);
    cleanupFns.push(() => iframeEl.removeEventListener('load', handleLoad));

    let doc: Document | null = null;
    let win: Window | null = null;
    try {
      doc = iframeEl.contentDocument || iframeEl.contentWindow?.document || null;
      win = iframeEl.contentWindow;
    } catch {
      // Cross-origin iframe blocked by SOP
      this.handleCrossOriginIframe(iframeEl, cleanupFns);
      return;
    }

    if (!doc || !win) {
      this.handleCrossOriginIframe(iframeEl, cleanupFns);
      return;
    }

    // Attach child MutationObserver
    if (typeof MutationObserver !== 'undefined' && doc.documentElement) {
      childObserver = new MutationObserver((mutations) => {
        this.handleMutations(mutations);
      });
      childObserver.observe(doc.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });
    }

    // Mouse Move listener inside child iframe with coordinate offset translation
    const mouseThrottle = this.ctx.config.mouseThrottleMs ?? 50;
    if (this.ctx.config.recordMouse !== false) {
      const handleIframeMouseMove = (e: MouseEvent) => {
        const now = performance.now();
        if (now - this.lastMouseMoveTime < mouseThrottle) return;
        this.lastMouseMoveTime = now;
        try {
          const rect = iframeEl.getBoundingClientRect();
          this.pushEvent({
            type: 'mouse_move',
            timestamp: this.getRelativeTime(),
            x: Math.round(rect.left + e.clientX),
            y: Math.round(rect.top + e.clientY)
          });
        } catch {}
      };
      try {
        win.addEventListener('mousemove', handleIframeMouseMove, { passive: true });
        cleanupFns.push(() => {
          try { win?.removeEventListener('mousemove', handleIframeMouseMove); } catch {}
        });
      } catch {}
    }

    // Mouse Clicks listener inside child iframe with coordinate offset translation
    const handleIframeMouseClick = (type: 'click' | 'mousedown' | 'mouseup') => (e: MouseEvent) => {
      try {
        const rect = iframeEl.getBoundingClientRect();
        this.pushEvent({
          type: 'mouse_click',
          timestamp: this.getRelativeTime(),
          x: Math.round(rect.left + e.clientX),
          y: Math.round(rect.top + e.clientY),
          clickType: type
        });
      } catch {}
    };
    const clickHandler = handleIframeMouseClick('click');
    try {
      win.addEventListener('click', clickHandler, { passive: true, capture: true });
      cleanupFns.push(() => {
        try { win?.removeEventListener('click', clickHandler, true); } catch {}
      });
    } catch {}

    // Form input listeners inside child iframe
    try {
      doc.addEventListener('input', this.handleInput, { passive: true, capture: true });
      doc.addEventListener('change', this.handleInput, { passive: true, capture: true });
      doc.addEventListener('select', this.handleInput, { passive: true, capture: true });
      cleanupFns.push(() => {
        try {
          doc?.removeEventListener('input', this.handleInput, true);
          doc?.removeEventListener('change', this.handleInput, true);
          doc?.removeEventListener('select', this.handleInput, true);
        } catch {}
      });
    } catch {}

    // Scroll listener inside child iframe
    try {
      const handleIframeScroll = () => {
        const targetId = this.ctx.nodeToId.get(iframeEl);
        this.pushEvent({
          type: 'scroll',
          timestamp: this.getRelativeTime(),
          x: win?.scrollX || win?.pageXOffset || doc?.documentElement?.scrollLeft || 0,
          y: win?.scrollY || win?.pageYOffset || doc?.documentElement?.scrollTop || 0,
          targetId
        });
      };
      win.addEventListener('scroll', handleIframeScroll, { passive: true });
      cleanupFns.push(() => {
        try { win?.removeEventListener('scroll', handleIframeScroll); } catch {}
      });
    } catch {}

    this.iframeTrackers.set(iframeEl, { observer: childObserver, cleanupFns });
  }

  private unobserveIframe(iframeEl: HTMLIFrameElement): void {
    const tracker = this.iframeTrackers.get(iframeEl);
    if (tracker) {
      tracker.observer?.disconnect();
      tracker.cleanupFns.forEach(fn => fn());
      this.iframeTrackers.delete(iframeEl);
    }
  }

  private clearIframeTrackers(): void {
    this.iframeTrackers.forEach((tracker) => {
      tracker.observer?.disconnect();
      tracker.cleanupFns.forEach(fn => fn());
    });
    this.iframeTrackers.clear();
  }

  private handleCrossOriginIframe(iframeEl: HTMLIFrameElement, cleanupFns: Array<() => void>): void {
    this.iframeTrackers.set(iframeEl, { cleanupFns });
    if (this.ctx.config.recordCrossOriginIframes !== false) {
      try {
        const win = iframeEl.contentWindow;
        if (win) {
          // Send handshake ping to child window
          win.postMessage({ type: 'sat:ping' } as IframeBridgeMessage, '*');
        }
      } catch {}
    }
  }

  private setupIframeBridgeListener(): void {
    const handleBridgeMessage = (e: MessageEvent) => {
      if (!this.isRecording || this.isPaused) return;

      const allowedOrigins = this.ctx.config.allowedIframeOrigins;
      if (allowedOrigins && allowedOrigins.length > 0) {
        if (!allowedOrigins.includes(e.origin) && !allowedOrigins.includes('*')) {
          return;
        }
      }

      const msg = e.data as IframeBridgeMessage;
      if (!msg || typeof msg !== 'object' || !('type' in msg)) return;

      const sourceWin = e.source as Window;
      const matchingIframe = this.findIframeByWindow(sourceWin);

      if (msg.type === 'sat:pong') {
        if (sourceWin) {
          if (matchingIframe) {
            this.bridgedIframes.set(sourceWin, matchingIframe);
          }
          try {
            sourceWin.postMessage({
              type: 'sat:start',
              config: this.ctx.config,
              startTime: this.startTime
            } as IframeBridgeMessage, e.origin !== 'null' && e.origin ? e.origin : '*');
          } catch {}
        }
      } else if (msg.type === 'sat:snapshot') {
        if (matchingIframe) {
          this.handleChildSnapshot(matchingIframe, msg.data, msg.viewport);
        }
      } else if (msg.type === 'sat:chunk') {
        if (matchingIframe && msg.events) {
          this.handleChildChunk(matchingIframe, msg.events);
        }
      }
    };

    window.addEventListener('message', handleBridgeMessage);
    this.cleanupFns.push(() => window.removeEventListener('message', handleBridgeMessage));
  }

  private findIframeByWindow(win: Window): HTMLIFrameElement | undefined {
    if (!win) return undefined;
    if (this.bridgedIframes.has(win)) {
      return this.bridgedIframes.get(win);
    }
    const iframes = document.querySelectorAll('iframe');
    for (let i = 0; i < iframes.length; i++) {
      const f = iframes[i];
      try {
        if (f.contentWindow === win) {
          return f;
        }
      } catch {}
    }
    return undefined;
  }

  private handleChildSnapshot(iframeEl: HTMLIFrameElement, snapshot: SerializedNode, _viewport: any): void {
    const iframeId = this.ctx.nodeToId.get(iframeEl);
    if (iframeId !== undefined) {
      // Find the iframe node in the initial dom_snapshot if present
      const initialSnapshot = this.events.find(ev => ev.type === 'dom_snapshot');
      if (initialSnapshot && initialSnapshot.type === 'dom_snapshot') {
        const findNode = (root: SerializedNode): SerializedNode | undefined => {
          if (root.id === iframeId) return root;
          if (root.children) {
            for (const child of root.children) {
              const found = findNode(child);
              if (found) return found;
            }
          }
          return undefined;
        };
        const node = findNode(initialSnapshot.data);
        if (node) {
          node.contentDocument = snapshot;
          node.isBridged = true;
          node.isCrossOrigin = true;
        }
      }

      // Also push a mutation event adding child document so dynamic updates render during replay
      this.pushEvent({
        type: 'mutation',
        timestamp: this.getRelativeTime(),
        addedNodes: [
          {
            parentId: iframeId,
            node: snapshot
          }
        ]
      });
    }
  }

  private handleChildChunk(iframeEl: HTMLIFrameElement, events: DomRecordingEvent[]): void {
    let rect: DOMRect | { left: number; top: number } = { left: 0, top: 0 };
    try {
      rect = iframeEl.getBoundingClientRect();
    } catch {}

    for (const ev of events) {
      if (ev.type === 'mouse_move') {
        this.pushEvent({
          type: 'mouse_move',
          timestamp: this.getRelativeTime(),
          x: Math.round(rect.left + ev.x),
          y: Math.round(rect.top + ev.y)
        });
      } else if (ev.type === 'mouse_click') {
        this.pushEvent({
          type: 'mouse_click',
          timestamp: this.getRelativeTime(),
          x: Math.round(rect.left + ev.x),
          y: Math.round(rect.top + ev.y),
          clickType: ev.clickType
        });
      } else if (ev.type === 'mutation' || ev.type === 'input' || ev.type === 'scroll' || ev.type === 'selection') {
        this.pushEvent({
          ...ev,
          timestamp: this.getRelativeTime()
        });
      }
    }
  }

  private handleInput = (e: Event): void => {
    let target = e.target as HTMLElement;
    if (!target || shouldIgnoreNode(target, this.ctx)) return;

    const tag = target.tagName ? target.tagName.toLowerCase() : '';
    if (tag === 'option' && target.parentElement && target.parentElement.tagName.toLowerCase() === 'select') {
      target = target.parentElement;
    }

    const targetId = this.ctx.nodeToId.get(target);
    if (targetId === undefined) return;

    const isMasked = isInputMasked(target, this.ctx);

    if (tag === 'input') {
      const inputEl = target as HTMLInputElement;
      if (inputEl.type === 'checkbox' || inputEl.type === 'radio') {
        this.pushEvent({
          type: 'input',
          timestamp: this.getRelativeTime(),
          targetId,
          value: inputEl.checked,
          checked: inputEl.checked
        });
      } else {
        const val = isMasked ? '••••••••' : inputEl.value;
        this.pushEvent({
          type: 'input',
          timestamp: this.getRelativeTime(),
          targetId,
          value: val
        });
      }
    } else if (tag === 'select') {
      const selectEl = target as HTMLSelectElement;
      const val = isMasked ? '' : selectEl.value;
      this.pushEvent({
        type: 'input',
        timestamp: this.getRelativeTime(),
        targetId,
        value: val,
        selectedIndex: isMasked ? -1 : selectEl.selectedIndex
      });
    } else if (tag === 'textarea') {
      const textEl = target as HTMLTextAreaElement;
      const val = isMasked ? '••••••••' : textEl.value;
      this.pushEvent({
        type: 'input',
        timestamp: this.getRelativeTime(),
        targetId,
        value: val
      });
    }
  };

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
    window.addEventListener('input', this.handleInput, { passive: true, capture: true });
    window.addEventListener('change', this.handleInput, { passive: true, capture: true });
    window.addEventListener('select', this.handleInput, { passive: true, capture: true });
    this.cleanupFns.push(() => window.removeEventListener('input', this.handleInput, true));
    this.cleanupFns.push(() => window.removeEventListener('change', this.handleInput, true));
    this.cleanupFns.push(() => window.removeEventListener('select', this.handleInput, true));

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
