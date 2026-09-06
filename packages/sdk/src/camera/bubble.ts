import { CameraConfig } from '../types';

export class CameraBubble {
  private hostElement?: HTMLElement;
  private shadowRoot?: ShadowRoot;
  private videoEl?: HTMLVideoElement;
  private shape: 'circle' | 'rect' = 'circle';
  private size = 160;
  private isMirrored = true;
  private isMuted = false;
  private cameraTrack?: MediaStreamTrack;

  private currentX = 24;
  private currentY = 24;
  private position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' = 'bottom-left';

  public onStateChange?: (state: { x: number; y: number; size: number; width: number; height: number; shape: 'circle' | 'rect'; isMuted: boolean; isMirrored: boolean }) => void;
  public onPopoutRequest?: () => void;

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getBubbleState());
    }
  }

  constructor(private stream: MediaStream, config: CameraConfig = {}) {
    this.shape = config.shape || 'circle';
    this.size = config.size || 160;
    this.position = config.position || 'bottom-left';
    this.isMirrored = config.mirrored !== false;
    this.cameraTrack = stream.getVideoTracks()[0];
  }

  mount(): void {
    if (typeof document === 'undefined') return;

    this.hostElement = document.createElement('show-and-tell-camera');
    this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 12px;
        color: #ffffff;
        z-index: 2147483646;
        position: fixed;
      }
      * { box-sizing: border-box; }
      .sat-cam-wrapper {
        position: fixed;
        display: flex;
        flex-direction: column;
        align-items: center;
        user-select: none;
        touch-action: none;
        cursor: grab;
        filter: drop-shadow(0 10px 25px rgba(0,0,0,0.5));
        transition: width 0.2s ease, height 0.2s ease, border-radius 0.2s ease;
      }
      .sat-cam-wrapper:active {
        cursor: grabbing;
      }
      .sat-cam-container {
        position: relative;
        overflow: hidden;
        background: #111827;
        border: 2px solid rgba(255, 255, 255, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .sat-cam-container.shape-circle {
        border-radius: 50%;
      }
      .sat-cam-container.shape-rect {
        border-radius: 12px;
        box-shadow: 0 12px 32px rgba(0,0,0,0.65), 0 0 0 1px rgba(255, 255, 255, 0.15);
      }
      video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        pointer-events: none;
      }
      video.mirrored {
        transform: scaleX(-1);
      }
      .sat-cam-muted-overlay {
        position: absolute;
        inset: 0;
        background: rgba(17, 24, 39, 0.9);
        display: none;
        align-items: center;
        justify-content: center;
        color: #94a3b8;
        font-size: 11px;
        font-weight: 500;
        flex-direction: column;
        gap: 6px;
      }
      .sat-cam-container.is-muted .sat-cam-muted-overlay {
        display: flex;
      }
      .sat-cam-toolbar {
        position: absolute;
        bottom: -36px;
        display: flex;
        align-items: center;
        gap: 4px;
        background: rgba(24, 24, 27, 0.9);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 9999px;
        padding: 3px 8px;
        opacity: 0;
        transform: translateY(-4px);
        transition: opacity 0.2s ease, transform 0.2s ease;
        pointer-events: none;
      }
      .sat-cam-wrapper:hover .sat-cam-toolbar {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }
      .sat-cam-btn {
        background: transparent;
        border: none;
        color: #cbd5e1;
        cursor: pointer;
        padding: 4px 6px;
        border-radius: 6px;
        font-size: 11px;
        display: flex;
        align-items: center;
        justify-content: center;
        outline: none;
        transition: all 0.15s;
      }
      .sat-cam-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        color: #ffffff;
      }
      .sat-cam-btn svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }
    `;

    this.shadowRoot.appendChild(style);

    const wrapper = document.createElement('div');
    wrapper.className = 'sat-cam-wrapper';

    // Calculate initial corner coordinates
    const initialPos = this.computeInitialPosition();
    wrapper.style.left = `${initialPos.x}px`;
    wrapper.style.top = `${initialPos.y}px`;
    this.currentX = initialPos.x;
    this.currentY = initialPos.y;

    const dim = this.getDimensions();
    wrapper.innerHTML = `
      <div class="sat-cam-container shape-${this.shape}" style="width: ${dim.width}px; height: ${dim.height}px;">
        <video autoplay playsinline muted class="${this.isMirrored ? 'mirrored' : ''}"></video>
        <div class="sat-cam-muted-overlay">
          <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: currentColor;"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          <span>Camera Off</span>
        </div>
      </div>
      <div class="sat-cam-toolbar">
        <button class="sat-cam-btn" id="shapeBtn" title="Toggle Shape (Circle / 16:9 Landscape)">
          <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/></svg>
        </button>
        <button class="sat-cam-btn" id="sizeBtn" title="Cycle Size (Small / Medium / Large)">
          <svg viewBox="0 0 24 24"><path d="M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z"/></svg>
        </button>
        <button class="sat-cam-btn" id="muteBtn" title="Mute/Unmute Camera">
          <svg id="muteIcon" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
        </button>
        <button class="sat-cam-btn" id="pipBtn" title="Float over all apps (Always-on-Top PiP across windows and tabs)">
          <svg viewBox="0 0 24 24"><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>
        </button>
      </div>
    `;

    this.shadowRoot.appendChild(wrapper);
    document.body.appendChild(this.hostElement);

    this.videoEl = wrapper.querySelector('video') as HTMLVideoElement;
    if (this.videoEl) {
      this.videoEl.srcObject = this.stream;
      const playPromise = this.videoEl.play?.();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    }

    const container = wrapper.querySelector('.sat-cam-container') as HTMLElement;
    const shapeBtn = wrapper.querySelector('#shapeBtn');
    const sizeBtn = wrapper.querySelector('#sizeBtn');
    const muteBtn = wrapper.querySelector('#muteBtn');

    const updateDimensions = () => {
      const d = this.getDimensions();
      container.style.width = `${d.width}px`;
      container.style.height = `${d.height}px`;
      container.className = `sat-cam-container shape-${this.shape}${this.isMuted ? ' is-muted' : ''}`;
      this.notifyStateChange();
    };

    // Controls listeners
    shapeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.shape = this.shape === 'circle' ? 'rect' : 'circle';
      updateDimensions();
    });

    const sizes = [120, 160, 220];
    sizeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const nextIdx = (sizes.indexOf(this.size) + 1) % sizes.length;
      this.size = sizes[nextIdx];
      updateDimensions();
    });

    muteBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isMuted = !this.isMuted;
      if (this.cameraTrack) {
        this.cameraTrack.enabled = !this.isMuted;
      }
      container.classList.toggle('is-muted', this.isMuted);
      this.notifyStateChange();
    });

    const pipBtn = wrapper.querySelector('#pipBtn');
    pipBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onPopoutRequest?.();
    });

    // Drag behavior (supports both mouse and touch)
    this.setupDraggable(wrapper);
    this.notifyStateChange();
  }

  getDimensions(): { width: number; height: number } {
    if (this.shape === 'circle') {
      return { width: this.size, height: this.size };
    }
    // 16:9 widescreen landscape (Google Meet / Picture-in-Picture style)
    const rectPresets: Record<number, { width: number; height: number }> = {
      120: { width: 200, height: 112 },
      160: { width: 260, height: 146 },
      220: { width: 340, height: 191 }
    };
    if (rectPresets[this.size]) {
      return rectPresets[this.size];
    }
    const width = Math.round(this.size * (16 / 10));
    return { width, height: Math.round((width * 9) / 16) };
  }

  private computeInitialPosition(): { x: number; y: number } {
    const margin = 24;
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 800;
    const { width, height } = this.getDimensions();

    switch (this.position) {
      case 'bottom-right':
        return { x: vw - width - margin, y: vh - height - margin };
      case 'top-left':
        return { x: margin, y: margin };
      case 'top-right':
        return { x: vw - width - margin, y: margin };
      case 'bottom-left':
      default:
        return { x: margin, y: vh - height - margin };
    }
  }

  private setupDraggable(wrapper: HTMLElement): void {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    const onPointerDown = (clientX: number, clientY: number) => {
      isDragging = true;
      startX = clientX;
      startY = clientY;
      initialLeft = this.currentX;
      initialTop = this.currentY;
    };

    const onPointerMove = (clientX: number, clientY: number) => {
      if (!isDragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;

      const maxX = Math.max(0, (window.innerWidth || 1280) - this.size - 10);
      const maxY = Math.max(0, (window.innerHeight || 800) - this.size - 10);

      this.currentX = Math.min(maxX, Math.max(10, initialLeft + dx));
      this.currentY = Math.min(maxY, Math.max(10, initialTop + dy));

      wrapper.style.left = `${this.currentX}px`;
      wrapper.style.top = `${this.currentY}px`;
    };

    const onPointerUp = () => {
      if (isDragging) {
        isDragging = false;
        this.notifyStateChange();
      }
    };

    wrapper.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('.sat-cam-toolbar')) return;
      onPointerDown(e.clientX, e.clientY);
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onPointerUp);

    wrapper.addEventListener('touchstart', (e) => {
      if ((e.target as HTMLElement).closest('.sat-cam-toolbar')) return;
      const touch = e.touches[0];
      onPointerDown(touch.clientX, touch.clientY);
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      onPointerMove(touch.clientX, touch.clientY);
    });
    window.addEventListener('touchend', onPointerUp);
  }

  getBubbleState(): { x: number; y: number; size: number; width: number; height: number; shape: 'circle' | 'rect'; isMuted: boolean; isMirrored: boolean } {
    const { width, height } = this.getDimensions();
    return {
      x: this.currentX,
      y: this.currentY,
      size: this.size,
      width,
      height,
      shape: this.shape,
      isMuted: this.isMuted,
      isMirrored: this.isMirrored
    };
  }

  hide(): void {
    if (this.hostElement) {
      this.hostElement.style.display = 'none';
    }
  }

  show(): void {
    if (this.hostElement) {
      this.hostElement.style.display = '';
    }
  }

  destroy(): void {
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
    if (this.hostElement && this.hostElement.parentNode) {
      this.hostElement.parentNode.removeChild(this.hostElement);
    }
    this.hostElement = undefined;
    this.shadowRoot = undefined;
  }
}
