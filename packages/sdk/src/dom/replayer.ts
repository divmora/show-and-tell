import { DomRecordingEvent, SerializedNode } from '../types';

export type ZoomMode = 'fit' | 1 | 1.5 | 2;

export interface DomReplayerOptions {
  events: DomRecordingEvent[];
  container: HTMLElement;
  cameraUrl?: string;
  initialZoom?: ZoomMode;
  onTimeUpdate?: (currentTimeMs: number, totalDurationMs: number) => void;
  onStateChange?: (isPlaying: boolean) => void;
  onEnded?: () => void;
  onZoomChange?: (mode: ZoomMode, scale: number) => void;
}

export class DomReplayer {
  private events: DomRecordingEvent[] = [];
  private container: HTMLElement;
  private cameraUrl?: string;
  private cameraWrapper?: HTMLElement;
  private cameraVideo?: HTMLVideoElement;
  private viewportSpacer?: HTMLElement;
  private viewportWrapper?: HTMLElement;
  private iframe?: HTMLIFrameElement;
  private iframeDoc?: Document;
  private virtualCursor?: HTMLElement;
  private resizeObserver?: ResizeObserver;
  private idToNode = new Map<number, Node>();
  private cleanupFns: Array<() => void> = [];

  private totalDurationMs = 0;
  private currentTimeMs = 0;
  private currentEventIndex = 0;
  private isPlaying = false;
  private playbackSpeed = 1;
  private animationFrameId?: number;
  private lastRafTimestamp = 0;

  // Zoom & Pan Configuration
  private zoomMode: ZoomMode = 'fit';
  private currentScale = 1;
  private fitScale = 1;

  // Browser View Size & Scroll Position (exact dimensions captured during recording)
  private recordedViewWidth = 1280;
  private recordedViewHeight = 800;
  private initialScrollX = 0;
  private initialScrollY = 0;

  private onTimeUpdate?: (currentTimeMs: number, totalDurationMs: number) => void;
  private onStateChange?: (isPlaying: boolean) => void;
  private onEnded?: () => void;
  private onZoomChange?: (mode: ZoomMode, scale: number) => void;

  constructor(options: DomReplayerOptions) {
    this.events = options.events || [];
    this.container = options.container;
    this.cameraUrl = options.cameraUrl;
    this.zoomMode = options.initialZoom || 'fit';
    this.onTimeUpdate = options.onTimeUpdate;
    this.onStateChange = options.onStateChange;
    this.onEnded = options.onEnded;
    this.onZoomChange = options.onZoomChange;

    if (this.events.length > 0) {
      const lastEvent = this.events[this.events.length - 1];
      this.totalDurationMs = Math.max(1000, lastEvent.timestamp);
    }

    const snap = this.events.find(e => e.type === 'dom_snapshot');
    if (snap && snap.type === 'dom_snapshot') {
      this.recordedViewWidth = snap.viewport.width || 1280;
      this.recordedViewHeight = snap.viewport.height || 800;
      this.initialScrollX = snap.viewport.scrollX || 0;
      this.initialScrollY = snap.viewport.scrollY || 0;
    }

    this.mount();
  }

  mount(): void {
    if (typeof document === 'undefined') return;

    this.container.innerHTML = '';
    this.container.style.position = 'relative';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.overflow = 'hidden';
    this.container.style.display = 'flex';
    this.container.style.padding = '12px';
    this.container.style.boxSizing = 'border-box';
    this.container.style.backgroundColor = '#0b0f19';

    // 0. Viewport Spacer: provides layout dimensions for native scrollbars and panning
    this.viewportSpacer = document.createElement('div');
    this.viewportSpacer.className = 'sat-viewport-spacer';
    this.viewportSpacer.style.position = 'relative';
    this.viewportSpacer.style.flexShrink = '0';
    this.viewportSpacer.style.margin = 'auto';

    // 1. Virtual Viewport Wrapper (Rendered at exact recorded browser view dimensions)
    this.viewportWrapper = document.createElement('div');
    this.viewportWrapper.className = 'sat-viewport-wrapper';
    this.viewportWrapper.style.position = 'absolute';
    this.viewportWrapper.style.top = '0';
    this.viewportWrapper.style.left = '0';
    this.viewportWrapper.style.width = `${this.recordedViewWidth}px`;
    this.viewportWrapper.style.height = `${this.recordedViewHeight}px`;
    this.viewportWrapper.style.transformOrigin = 'top left';
    this.viewportWrapper.style.backgroundColor = '#ffffff';
    this.viewportWrapper.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';

    // 2. Sandboxed Replay Iframe
    this.iframe = document.createElement('iframe');
    this.iframe.style.width = `${this.recordedViewWidth}px`;
    this.iframe.style.height = `${this.recordedViewHeight}px`;
    this.iframe.style.border = 'none';
    this.iframe.style.display = 'block';
    this.iframe.setAttribute('sandbox', 'allow-same-origin');
    this.viewportWrapper.appendChild(this.iframe);

    // 3. Virtual Cursor
    this.virtualCursor = document.createElement('div');
    this.virtualCursor.className = 'sat-virtual-cursor';
    this.virtualCursor.style.position = 'absolute';
    this.virtualCursor.style.width = '16px';
    this.virtualCursor.style.height = '16px';
    this.virtualCursor.style.pointerEvents = 'none';
    this.virtualCursor.style.zIndex = '999999';
    this.virtualCursor.style.transform = 'translate(-2px, -2px)';
    this.virtualCursor.style.transition = 'transform 0.04s linear, opacity 0.2s ease';
    this.virtualCursor.style.display = 'none';
    this.virtualCursor.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));">
        <path d="M4 2l16 10-6.5 1.5 4.5 7.5-2.5 1.5-4.5-7.5L7 18z" fill="#ef4444" stroke="#ffffff" stroke-width="1.5"/>
      </svg>
    `;
    this.viewportWrapper.appendChild(this.virtualCursor);

    // 4. Synchronized Camera Bubble (if camera was recorded)
    if (this.cameraUrl) {
      this.cameraWrapper = document.createElement('div');
      this.cameraWrapper.className = 'sat-replay-camera-wrapper';
      this.cameraWrapper.style.position = 'absolute';
      this.cameraWrapper.style.zIndex = '999990';
      this.cameraWrapper.style.overflow = 'hidden';
      this.cameraWrapper.style.backgroundColor = '#111827';
      this.cameraWrapper.style.border = '2px solid rgba(255, 255, 255, 0.25)';
      this.cameraWrapper.style.filter = 'drop-shadow(0 10px 25px rgba(0,0,0,0.5))';
      this.cameraWrapper.style.transition = 'width 0.2s ease, height 0.2s ease, border-radius 0.2s ease';
      this.cameraWrapper.style.pointerEvents = 'none';

      const firstCamEvent = this.events.find(e => e.type === 'camera_position') as any;
      const initialW = firstCamEvent?.width || 160;
      const initialH = firstCamEvent?.height || 160;
      const initialX = firstCamEvent?.x ?? 24;
      const initialY = firstCamEvent?.y ?? Math.max(10, this.recordedViewHeight - initialH - 24);
      const isRect = firstCamEvent?.shape === 'rect';

      this.cameraWrapper.style.width = `${initialW}px`;
      this.cameraWrapper.style.height = `${initialH}px`;
      this.cameraWrapper.style.left = `${initialX}px`;
      this.cameraWrapper.style.top = `${initialY}px`;
      this.cameraWrapper.style.borderRadius = isRect ? '12px' : '50%';

      this.cameraVideo = document.createElement('video');
      this.cameraVideo.src = this.cameraUrl;
      this.cameraVideo.playsInline = true;
      this.cameraVideo.muted = true;
      this.cameraVideo.autoplay = false;
      this.cameraVideo.style.width = '100%';
      this.cameraVideo.style.height = '100%';
      this.cameraVideo.style.objectFit = 'cover';
      this.cameraVideo.style.transform = 'scaleX(-1)';
      this.cameraVideo.style.pointerEvents = 'none';

      this.cameraWrapper.appendChild(this.cameraVideo);
      this.viewportWrapper.appendChild(this.cameraWrapper);
    }

    this.viewportSpacer.appendChild(this.viewportWrapper);
    this.container.appendChild(this.viewportSpacer);

    // Setup interactive grab-to-pan support
    this.setupPanEvents();

    // Initial scale-to-fit calculation
    this.updateScaling();

    // Listen to container resizing
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateScaling();
      });
      this.resizeObserver.observe(this.container);
    }

    this.initIframeContent();
  }

  updateScaling(): void {
    if (!this.viewportWrapper || !this.container || !this.viewportSpacer) return;

    const padX = 24;
    const padY = 24;
    const containerW = Math.max(100, this.container.clientWidth - padX);
    const containerH = Math.max(100, this.container.clientHeight - padY);
    if (!containerW || !containerH) return;

    this.fitScale = Math.min(
      containerW / this.recordedViewWidth,
      containerH / this.recordedViewHeight
    );

    let scale = this.fitScale;
    if (this.zoomMode === 1) {
      scale = 1.0;
    } else if (this.zoomMode === 1.5) {
      scale = 1.5;
    } else if (this.zoomMode === 2) {
      scale = 2.0;
    }

    this.currentScale = scale;

    const scaledW = Math.round(this.recordedViewWidth * scale);
    const scaledH = Math.round(this.recordedViewHeight * scale);

    this.viewportSpacer.style.width = `${scaledW}px`;
    this.viewportSpacer.style.height = `${scaledH}px`;
    this.viewportWrapper.style.transform = `scale(${scale})`;

    // If zoomed in (scale > fitScale), enable scrolling and grab-to-pan cursor
    if (scale > this.fitScale * 1.02) {
      this.container.style.overflow = 'auto';
      this.container.style.cursor = 'grab';
    } else {
      this.container.style.overflow = 'hidden';
      this.container.style.cursor = 'default';
    }
    this.viewportSpacer.style.margin = 'auto';

    this.onZoomChange?.(this.zoomMode, scale);
  }

  setZoom(mode: ZoomMode): void {
    this.zoomMode = mode;
    this.updateScaling();
  }

  cycleZoom(): ZoomMode {
    const modes: ZoomMode[] = ['fit', 1, 1.5];
    const nextIdx = (modes.indexOf(this.zoomMode) + 1) % modes.length;
    this.setZoom(modes[nextIdx]);
    return this.zoomMode;
  }

  getZoom(): ZoomMode {
    return this.zoomMode;
  }

  getScale(): number {
    return this.currentScale;
  }

  private setupPanEvents(): void {
    let isPanning = false;
    let startX = 0;
    let startY = 0;
    let startScrollLeft = 0;
    let startScrollTop = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (this.container.style.overflow !== 'auto') return;

      isPanning = true;
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = this.container.scrollLeft;
      startScrollTop = this.container.scrollTop;
      this.container.style.cursor = 'grabbing';
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      this.container.scrollLeft = startScrollLeft - dx;
      this.container.scrollTop = startScrollTop - dy;
    };

    const onMouseUp = () => {
      if (isPanning) {
        isPanning = false;
        this.container.style.cursor = this.container.style.overflow === 'auto' ? 'grab' : 'default';
      }
    };

    this.container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    this.cleanupFns.push(() => {
      this.container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    });
  }

  private initIframeContent(): void {
    if (!this.iframe) return;

    const doc = this.iframe.contentDocument || this.iframe.contentWindow?.document;
    if (!doc) return;
    this.iframeDoc = doc;

    const baseHref = typeof document !== 'undefined' && document.baseURI ? document.baseURI : window.location.href;

    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><base href="${baseHref}"></head><body></body></html>`);
    doc.close();

    // Disable link navigations and pointer clicks inside replay iframe
    const style = doc.createElement('style');
    style.textContent = `
      * { pointer-events: none !important; }
      body { margin: 0; padding: 0; }
    `;
    doc.head.appendChild(style);

    this.resetToStart();
  }

  private resetToStart(): void {
    this.currentTimeMs = 0;
    this.currentEventIndex = 0;
    this.idToNode.clear();

    if (!this.iframeDoc) return;

    const currentSel = this.iframeDoc.getSelection();
    if (currentSel) currentSel.removeAllRanges();

    // Rebuild initial snapshot
    const snapshotEvent = this.events.find(e => e.type === 'dom_snapshot');
    if (snapshotEvent && snapshotEvent.type === 'dom_snapshot') {
      const rootNode = this.buildDomNode(snapshotEvent.data);
      if (rootNode && this.iframeDoc.documentElement) {
        this.iframeDoc.replaceChild(rootNode, this.iframeDoc.documentElement);

        // Inject <base> tag so relative CSS/assets resolve
        const baseHref = typeof document !== 'undefined' && document.baseURI ? document.baseURI : window.location.href;
        const base = this.iframeDoc.createElement('base');
        base.href = baseHref;
        if (this.iframeDoc.head) {
          this.iframeDoc.head.insertBefore(base, this.iframeDoc.head.firstChild);
        }

        // Re-inject safety style
        const style = this.iframeDoc.createElement('style');
        style.textContent = `
          * { pointer-events: none !important; }
        `;
        if (this.iframeDoc.head) {
          this.iframeDoc.head.appendChild(style);
        }
      }

      // Auto-scroll immediately to the recorded initial scroll offset!
      if (this.iframe && this.iframe.contentWindow) {
        try {
          this.iframe.contentWindow.scrollTo(this.initialScrollX, this.initialScrollY);
        } catch {}
      }
    }

    if (this.virtualCursor) {
      this.virtualCursor.style.display = 'none';
    }

    if (this.cameraVideo) {
      this.cameraVideo.currentTime = 0;
      const firstCamEvent = this.events.find(e => e.type === 'camera_position') as any;
      if (this.cameraWrapper && firstCamEvent) {
        this.cameraWrapper.style.width = `${firstCamEvent.width}px`;
        this.cameraWrapper.style.height = `${firstCamEvent.height}px`;
        this.cameraWrapper.style.left = `${firstCamEvent.x}px`;
        this.cameraWrapper.style.top = `${firstCamEvent.y}px`;
        this.cameraWrapper.style.borderRadius = firstCamEvent.shape === 'rect' ? '12px' : '50%';
      }
    }

    this.onTimeUpdate?.(0, this.totalDurationMs);
  }

  private buildDomNode(node: SerializedNode): Node | null {
    if (!this.iframeDoc || !node) return null;

    if (node.type === 'text') {
      const textNode = this.iframeDoc.createTextNode(node.textContent || '');
      this.idToNode.set(node.id, textNode);
      return textNode;
    }

    if (node.type === 'element' && node.tagName) {
      const el = this.iframeDoc.createElement(node.tagName);
      this.idToNode.set(node.id, el);

      // Set attributes
      if (node.attributes) {
        for (const [key, val] of Object.entries(node.attributes)) {
          try {
            if (key.startsWith('on') || key === 'action') continue;
            el.setAttribute(key, val);
          } catch {}
        }
      }

      // Children (append first so <select> options are available before setting value)
      if (node.children) {
        for (const child of node.children) {
          const childNode = this.buildDomNode(child);
          if (childNode) {
            el.appendChild(childNode);
          }
        }
      }

      // Handle form values (after children are appended)
      if (node.isInput) {
        const tagName = el.tagName.toLowerCase();
        if (tagName === 'select') {
          const selectEl = el as HTMLSelectElement;
          if (node.value !== undefined) {
            selectEl.value = String(node.value);
          }
          if (node.selectedIndex !== undefined && selectEl.selectedIndex !== node.selectedIndex) {
            selectEl.selectedIndex = node.selectedIndex;
          }
          for (let i = 0; i < selectEl.options.length; i++) {
            const opt = selectEl.options[i];
            if (node.value !== undefined && opt.value === String(node.value)) {
              opt.selected = true;
            } else if (node.selectedIndex !== undefined && i === node.selectedIndex) {
              opt.selected = true;
            }
          }
        } else {
          const inputEl = el as HTMLInputElement;
          if (inputEl.type === 'checkbox' || inputEl.type === 'radio') {
            inputEl.checked = !!node.value;
          } else if (node.value !== undefined) {
            inputEl.value = String(node.value);
          }
        }
      }

      return el;
    }

    return null;
  }

  play(): void {
    if (this.isPlaying) return;
    if (this.currentTimeMs >= this.totalDurationMs) {
      this.resetToStart();
    }

    this.isPlaying = true;
    this.lastRafTimestamp = performance.now();
    this.onStateChange?.(true);

    if (this.cameraVideo) {
      this.cameraVideo.playbackRate = this.playbackSpeed;
      this.cameraVideo.play().catch(() => {});
    }

    const loop = (timestamp: number) => {
      if (!this.isPlaying) return;

      const delta = (timestamp - this.lastRafTimestamp) * this.playbackSpeed;
      this.lastRafTimestamp = timestamp;
      this.currentTimeMs = Math.min(this.totalDurationMs, this.currentTimeMs + delta);

      this.dispatchEventsUpTo(this.currentTimeMs);
      this.onTimeUpdate?.(this.currentTimeMs, this.totalDurationMs);

      if (this.cameraVideo && Number.isFinite(this.cameraVideo.currentTime)) {
        const expectedSec = this.currentTimeMs / 1000;
        if (Math.abs(this.cameraVideo.currentTime - expectedSec) > 0.3) {
          this.cameraVideo.currentTime = expectedSec;
        }
      }

      if (this.currentTimeMs >= this.totalDurationMs) {
        this.pause();
        this.onEnded?.();
        return;
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  pause(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.animationFrameId !== undefined) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }
    if (this.cameraVideo) {
      this.cameraVideo.pause();
    }
    this.onStateChange?.(false);
  }

  togglePlay(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  seek(targetTimeMs: number): void {
    const wasPlaying = this.isPlaying;
    this.pause();

    const clamped = Math.max(0, Math.min(this.totalDurationMs, targetTimeMs));
    this.resetToStart();
    this.dispatchEventsUpTo(clamped);
    this.currentTimeMs = clamped;
    if (this.cameraVideo) {
      this.cameraVideo.currentTime = Math.max(0, clamped / 1000);
    }
    this.onTimeUpdate?.(this.currentTimeMs, this.totalDurationMs);

    if (wasPlaying) {
      this.play();
    }
  }

  setSpeed(speed: number): void {
    this.playbackSpeed = speed;
    if (this.cameraVideo) {
      this.cameraVideo.playbackRate = speed;
    }
  }

  private dispatchEventsUpTo(targetTimeMs: number): void {
    while (this.currentEventIndex < this.events.length) {
      const event = this.events[this.currentEventIndex];
      if (event.timestamp > targetTimeMs) {
        break;
      }
      this.applyEvent(event);
      this.currentEventIndex++;
    }
  }

  private applyEvent(event: DomRecordingEvent): void {
    if (!this.iframeDoc) return;

    switch (event.type) {
      case 'mutation': {
        // Removals
        if (event.removedNodeIds) {
          for (const id of event.removedNodeIds) {
            const node = this.idToNode.get(id);
            if (node && node.parentNode) {
              node.parentNode.removeChild(node);
              this.idToNode.delete(id);
            }
          }
        }

        // Additions
        if (event.addedNodes) {
          for (const item of event.addedNodes) {
            const parent = this.idToNode.get(item.parentId);
            if (parent && parent.nodeType === Node.ELEMENT_NODE) {
              const newNode = this.buildDomNode(item.node);
              if (newNode) {
                const nextSibling = item.nextSiblingId ? this.idToNode.get(item.nextSiblingId) : null;
                parent.insertBefore(newNode, nextSibling || null);
              }
            }
          }
        }

        // Attribute changes
        if (event.attributeChanges) {
          for (const attr of event.attributeChanges) {
            const node = this.idToNode.get(attr.nodeId);
            if (node && node.nodeType === Node.ELEMENT_NODE) {
              const el = node as Element;
              if (attr.value === null) {
                el.removeAttribute(attr.name);
              } else {
                try {
                  el.setAttribute(attr.name, attr.value);
                } catch {}
              }
            }
          }
        }

        // Text changes
        if (event.textChanges) {
          for (const text of event.textChanges) {
            const node = this.idToNode.get(text.nodeId);
            if (node) {
              node.textContent = text.value;
            }
          }
        }
        break;
      }

      case 'mouse_move': {
        if (this.virtualCursor) {
          this.virtualCursor.style.display = 'block';
          this.virtualCursor.style.left = `${event.x}px`;
          this.virtualCursor.style.top = `${event.y}px`;

          // If zoomed in (container overflow auto), gently auto-follow cursor
          if (this.container.style.overflow === 'auto') {
            const cursorScreenX = event.x * this.currentScale;
            const cursorScreenY = event.y * this.currentScale;
            const viewLeft = this.container.scrollLeft;
            const viewTop = this.container.scrollTop;
            const viewW = this.container.clientWidth;
            const viewH = this.container.clientHeight;

            if (cursorScreenX < viewLeft + 40 || cursorScreenX > viewLeft + viewW - 40) {
              this.container.scrollLeft = Math.max(0, cursorScreenX - viewW / 2);
            }
            if (cursorScreenY < viewTop + 40 || cursorScreenY > viewTop + viewH - 40) {
              this.container.scrollTop = Math.max(0, cursorScreenY - viewH / 2);
            }
          }
        }
        break;
      }

      case 'mouse_click': {
        if (this.virtualCursor && this.viewportWrapper) {
          this.virtualCursor.style.display = 'block';
          this.virtualCursor.style.left = `${event.x}px`;
          this.virtualCursor.style.top = `${event.y}px`;

          // Click ripple effect inside the viewport wrapper
          const ripple = document.createElement('div');
          ripple.style.position = 'absolute';
          ripple.style.left = `${event.x - 12}px`;
          ripple.style.top = `${event.y - 12}px`;
          ripple.style.width = '24px';
          ripple.style.height = '24px';
          ripple.style.borderRadius = '50%';
          ripple.style.backgroundColor = 'rgba(239, 68, 68, 0.45)';
          ripple.style.border = '2px solid #ef4444';
          ripple.style.pointerEvents = 'none';
          ripple.style.zIndex = '999998';
          ripple.style.transform = 'scale(0.5)';
          ripple.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
          this.viewportWrapper.appendChild(ripple);

          requestAnimationFrame(() => {
            ripple.style.transform = 'scale(1.8)';
            ripple.style.opacity = '0';
          });
          setTimeout(() => {
            if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
          }, 350);
        }
        break;
      }

      case 'scroll': {
        // Auto-scroll the replay viewport to exact recorded scroll position
        if (this.iframe && this.iframe.contentWindow) {
          try {
            this.iframe.contentWindow.scrollTo(event.x, event.y);
          } catch {}
        }
        break;
      }

      case 'resize': {
        // Handle recorded browser view resize events
        this.recordedViewWidth = event.width;
        this.recordedViewHeight = event.height;
        if (this.viewportWrapper && this.iframe) {
          this.viewportWrapper.style.width = `${event.width}px`;
          this.viewportWrapper.style.height = `${event.height}px`;
          this.iframe.style.width = `${event.width}px`;
          this.iframe.style.height = `${event.height}px`;
          this.updateScaling();
        }
        break;
      }

      case 'input': {
        const target = this.idToNode.get(event.targetId);
        if (target && target.nodeType === Node.ELEMENT_NODE) {
          const el = target as HTMLElement;
          const tagName = el.tagName.toLowerCase();
          if (tagName === 'input') {
            const inputEl = el as HTMLInputElement;
            if (inputEl.type === 'checkbox' || inputEl.type === 'radio') {
              inputEl.checked = !!event.checked;
            } else {
              inputEl.value = String(event.value);
            }
          } else if (tagName === 'select') {
            const selectEl = el as HTMLSelectElement;
            selectEl.value = String(event.value);
            if (event.selectedIndex !== undefined && selectEl.selectedIndex !== event.selectedIndex) {
              selectEl.selectedIndex = event.selectedIndex;
            }
            for (let i = 0; i < selectEl.options.length; i++) {
              const opt = selectEl.options[i];
              if (opt.value === String(event.value) || (event.selectedIndex !== undefined && i === event.selectedIndex)) {
                opt.selected = true;
              } else {
                opt.selected = false;
              }
            }
            try {
              selectEl.dispatchEvent(new Event('change', { bubbles: true }));
            } catch {}
          } else if (tagName === 'textarea') {
            (el as HTMLTextAreaElement).value = String(event.value);
          }
        }
        break;
      }

      case 'selection': {
        if (!this.iframeDoc) break;
        const sel = this.iframeDoc.getSelection();
        if (!sel) break;
        sel.removeAllRanges();
        if (event.ranges && event.ranges.length > 0) {
          for (const r of event.ranges) {
            const startNode = this.idToNode.get(r.startNodeId);
            const endNode = this.idToNode.get(r.endNodeId);
            if (startNode && endNode) {
              try {
                const range = this.iframeDoc.createRange();
                const startMax = startNode.nodeType === Node.TEXT_NODE ? (startNode.textContent?.length || 0) : startNode.childNodes.length;
                const endMax = endNode.nodeType === Node.TEXT_NODE ? (endNode.textContent?.length || 0) : endNode.childNodes.length;
                range.setStart(startNode, Math.min(r.startOffset, startMax));
                range.setEnd(endNode, Math.min(r.endOffset, endMax));
                sel.addRange(range);
              } catch {}
            }
          }
        }
        break;
      }

      case 'camera_position': {
        if (this.cameraWrapper) {
          this.cameraWrapper.style.display = 'block';
          this.cameraWrapper.style.left = `${event.x}px`;
          this.cameraWrapper.style.top = `${event.y}px`;
          this.cameraWrapper.style.width = `${event.width}px`;
          this.cameraWrapper.style.height = `${event.height}px`;
          this.cameraWrapper.style.borderRadius = event.shape === 'rect' ? '12px' : '50%';
          if (this.cameraVideo && event.isMuted !== undefined) {
            this.cameraVideo.style.opacity = event.isMuted ? '0.2' : '1';
          }
        }
        break;
      }
    }
  }

  destroy(): void {
    this.pause();
    if (this.cameraVideo) {
      this.cameraVideo.pause();
      this.cameraVideo.src = '';
      this.cameraVideo = undefined;
    }
    if (this.cameraWrapper) {
      this.cameraWrapper.remove();
      this.cameraWrapper = undefined;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
    for (const fn of this.cleanupFns) {
      try { fn(); } catch {}
    }
    this.cleanupFns = [];
    this.idToNode.clear();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
