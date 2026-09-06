import { DurationTracker } from '../core/duration-tracker';
import { RecordingSession, CameraConfig } from '../types';
import { formatDuration } from '../utils/time';

export interface PipControllerOptions {
  session: RecordingSession;
  durationTracker?: DurationTracker;
  cameraStream?: MediaStream;
  micStream?: MediaStream;
  cameraConfig?: CameraConfig;
  hasMic?: boolean;
  onClose?: () => void;
  onToggleMic?: () => boolean;
  onToggleCamera?: () => boolean;
  onStateChange?: (state: { x: number; y: number; size: number; width: number; height: number; shape: 'circle' | 'rect'; isMuted: boolean; isMirrored: boolean }) => void;
}

const PIP_ICONS = {
  pause: `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
  play: `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
  stop: `<svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>`,
  micOn: `<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>`,
  micOff: `<svg viewBox="0 0 24 24"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17L12.06 8.25c.01-.08.02-.16.02-.25V5c0-1.66-1.34-3-3-3-.25 0-.49.04-.71.1l7.61 7.61v1.71zm-9.74-7.9 1.41-1.41L21.19 19.4l-1.41 1.41-4.22-4.22C14.47 17.37 13.3 18 12 18c-3.41 0-6.23-2.72-6.72-6H3.58C4.06 15.28 6.78 18.1 10 18.58V21h2v-2.42c.86-.13 1.66-.43 2.37-.87l-7.13-7.14V11H5.58c0 .28.03.55.08.81L4.24 3.27z"/></svg>`,
  camOn: `<svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`,
  camOff: `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
  shape: `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/></svg>`,
  dock: `<svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>`
};

export class PipController {
  private pipWindow: Window | null = null;
  private unsubscribeTick?: () => void;
  private isMutedMic = false;
  private isMutedCam = false;
  private currentShape: 'circle' | 'rect' = 'rect';
  private videoEl?: HTMLVideoElement;
  private timerEl?: HTMLElement;
  private pauseBtn?: HTMLButtonElement;
  private micBtn?: HTMLButtonElement;
  private camBtn?: HTMLButtonElement;
  private containerEl?: HTMLElement;

  /**
   * Check whether Document Picture-in-Picture is supported by the current browser environment.
   */
  static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'documentPictureInPicture' in window &&
      typeof (window as any).documentPictureInPicture?.requestWindow === 'function'
    );
  }

  /**
   * Returns true if an active Document PiP window is currently open.
   */
  isActive(): boolean {
    return !!this.pipWindow && !this.pipWindow.closed;
  }

  /**
   * Open the always-on-top Document Picture-in-Picture window.
   */
  async open(options: PipControllerOptions): Promise<Window | null> {
    if (!PipController.isSupported()) {
      return null;
    }

    if (this.isActive()) {
      return this.pipWindow;
    }

    const hasCamera = !!options.cameraStream;
    this.currentShape = options.cameraConfig?.shape || (hasCamera ? 'rect' : 'circle');

    // Calculate optimal window dimensions
    let initialWidth = 280;
    let initialHeight = 80;

    if (hasCamera) {
      if (this.currentShape === 'rect') {
        initialWidth = 300;
        initialHeight = 235; // 16:9 webcam (approx 300x168) + controls toolbar (approx 55px)
      } else {
        initialWidth = 240;
        initialHeight = 285; // 1:1 circle webcam (approx 210x210) + controls toolbar (approx 55px)
      }
    }

    try {
      const pip = (window as any).documentPictureInPicture;
      this.pipWindow = await pip.requestWindow({
        width: initialWidth,
        height: initialHeight
      });

      if (!this.pipWindow) return null;

      this.setupPipDocument(options);
      return this.pipWindow;
    } catch (err) {
      console.warn('[ShowAndTell] Failed to open Document Picture-in-Picture window:', err);
      return null;
    }
  }

  private setupPipDocument(options: PipControllerOptions): void {
    if (!this.pipWindow) return;

    const doc = this.pipWindow.document;
    doc.title = 'ShowAndTell — Recording Active';

    // 1. Injected styles
    const styleEl = doc.createElement('style');
    styleEl.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body {
        width: 100%;
        height: 100%;
        background-color: #0b0f19;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        user-select: none;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .sat-pip-root {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        padding: 8px;
        background: #0b0f19;
      }
      .sat-pip-camera-box {
        position: relative;
        flex: 1;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border-radius: ${this.currentShape === 'circle' ? '50%' : '12px'};
        border: 2px solid rgba(255, 255, 255, 0.2);
        background: #111827;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        transition: border-radius 0.25s ease;
      }
      .sat-pip-camera-box.shape-circle {
        max-width: 180px;
        max-height: 180px;
        aspect-ratio: 1 / 1;
        border-radius: 50%;
      }
      .sat-pip-camera-box.shape-rect {
        width: 100%;
        aspect-ratio: 16 / 9;
        border-radius: 12px;
      }
      video {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transform: scaleX(-1);
      }
      .sat-pip-muted-overlay {
        position: absolute;
        inset: 0;
        background: rgba(17, 24, 39, 0.9);
        display: none;
        align-items: center;
        justify-content: center;
        color: #94a3b8;
        font-size: 11px;
        font-weight: 500;
        gap: 6px;
      }
      .sat-pip-muted-overlay.is-active {
        display: flex;
      }
      .sat-pip-toolbar {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(17, 24, 39, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        padding: 6px 10px;
        margin-top: 6px;
        gap: 8px;
        flex-shrink: 0;
      }
      .sat-pip-status {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .sat-pip-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #ef4444;
        animation: sat-pip-pulse 1.5s infinite;
      }
      @keyframes sat-pip-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.85); }
      }
      .sat-pip-timer {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 13px;
        font-weight: 700;
        color: #f1f5f9;
        letter-spacing: -0.5px;
      }
      .sat-pip-buttons {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .sat-pip-btn {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #e2e8f0;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        outline: none;
        transition: all 0.15s ease;
      }
      .sat-pip-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        color: #ffffff;
        transform: translateY(-1px);
      }
      .sat-pip-btn:active {
        transform: translateY(0);
      }
      .sat-pip-btn-stop {
        background: rgba(239, 68, 68, 0.25);
        border-color: rgba(239, 68, 68, 0.4);
        color: #fca5a5;
      }
      .sat-pip-btn-stop:hover {
        background: #ef4444;
        color: #ffffff;
      }
      .sat-pip-btn svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }
      .sat-pip-paused .sat-pip-dot {
        background-color: #f59e0b;
        animation: none;
      }
    `;
    doc.head.appendChild(styleEl);

    // 2. Build DOM layout
    const rootEl = doc.createElement('div');
    rootEl.className = 'sat-pip-root';

    const hasCamera = !!options.cameraStream;
    let cameraHtml = '';
    if (hasCamera) {
      cameraHtml = `
        <div class="sat-pip-camera-box shape-${this.currentShape}">
          <video autoplay playsinline muted></video>
          <div class="sat-pip-muted-overlay">
            <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            <span>Camera Off</span>
          </div>
        </div>
      `;
    }

    const hasMic = options.hasMic || !!options.micStream;

    rootEl.innerHTML = `
      ${cameraHtml}
      <div class="sat-pip-toolbar">
        <div class="sat-pip-status">
          <div class="sat-pip-dot"></div>
          <span class="sat-pip-timer">00:00</span>
        </div>
        <div class="sat-pip-buttons">
          ${hasCamera ? `
            <button class="sat-pip-btn sat-pip-btn-shape" title="Toggle Shape (Circle / 16:9 Meet Rectangle)">
              ${PIP_ICONS.shape}
            </button>
            <button class="sat-pip-btn sat-pip-btn-cam" title="Mute/Unmute Camera">
              ${PIP_ICONS.camOn}
            </button>
          ` : ''}
          ${hasMic ? `
            <button class="sat-pip-btn sat-pip-btn-mic" title="Mute/Unmute Mic">
              ${PIP_ICONS.micOn}
            </button>
          ` : ''}
          <button class="sat-pip-btn sat-pip-btn-pause" title="Pause/Resume">
            ${PIP_ICONS.pause}
          </button>
          <button class="sat-pip-btn sat-pip-btn-stop" title="Stop Recording">
            ${PIP_ICONS.stop}
          </button>
          <button class="sat-pip-btn sat-pip-btn-dock" title="Dock back to page">
            ${PIP_ICONS.dock}
          </button>
        </div>
      </div>
    `;

    doc.body.appendChild(rootEl);

    // 3. Connect elements
    this.containerEl = rootEl;
    this.timerEl = rootEl.querySelector('.sat-pip-timer') as HTMLElement;
    this.pauseBtn = rootEl.querySelector('.sat-pip-btn-pause') as HTMLButtonElement;
    this.micBtn = rootEl.querySelector('.sat-pip-btn-mic') as HTMLButtonElement;
    this.camBtn = rootEl.querySelector('.sat-pip-btn-cam') as HTMLButtonElement;
    const stopBtn = rootEl.querySelector('.sat-pip-btn-stop') as HTMLButtonElement;
    const dockBtn = rootEl.querySelector('.sat-pip-btn-dock') as HTMLButtonElement;
    const shapeBtn = rootEl.querySelector('.sat-pip-btn-shape') as HTMLButtonElement;

    if (hasCamera) {
      this.videoEl = rootEl.querySelector('video') as HTMLVideoElement;
      if (this.videoEl && options.cameraStream) {
        this.videoEl.srcObject = options.cameraStream;
        this.videoEl.play?.()?.catch?.(() => {});
      }
    }

    // 4. Hook up listeners
    this.pauseBtn?.addEventListener('click', () => {
      if (options.session.state === 'recording') {
        options.session.pause();
        this.updateState('paused');
      } else if (options.session.state === 'paused') {
        options.session.resume();
        this.updateState('recording');
      }
    });

    stopBtn?.addEventListener('click', () => {
      options.session.stop();
      this.close();
    });

    dockBtn?.addEventListener('click', () => {
      this.close();
    });

    shapeBtn?.addEventListener('click', () => {
      this.currentShape = this.currentShape === 'circle' ? 'rect' : 'circle';
      const camBox = rootEl.querySelector('.sat-pip-camera-box');
      if (camBox) {
        camBox.className = `sat-pip-camera-box shape-${this.currentShape}`;
      }
      options.onStateChange?.({
        x: 24,
        y: 24,
        size: 160,
        width: this.currentShape === 'rect' ? 260 : 160,
        height: this.currentShape === 'rect' ? 146 : 160,
        shape: this.currentShape,
        isMuted: this.isMutedCam,
        isMirrored: true
      });
    });

    this.camBtn?.addEventListener('click', () => {
      this.isMutedCam = !this.isMutedCam;
      if (options.cameraStream) {
        options.cameraStream.getVideoTracks().forEach(t => {
          t.enabled = !this.isMutedCam;
        });
      }
      const overlay = rootEl.querySelector('.sat-pip-muted-overlay');
      if (overlay) {
        overlay.classList.toggle('is-active', this.isMutedCam);
      }
      if (this.camBtn) {
        this.camBtn.innerHTML = this.isMutedCam ? PIP_ICONS.camOff : PIP_ICONS.camOn;
      }
      options.onToggleCamera?.();
    });

    this.micBtn?.addEventListener('click', () => {
      this.isMutedMic = !this.isMutedMic;
      if (options.micStream) {
        options.micStream.getAudioTracks().forEach(t => {
          t.enabled = !this.isMutedMic;
        });
      }
      if (this.micBtn) {
        this.micBtn.innerHTML = this.isMutedMic ? PIP_ICONS.micOff : PIP_ICONS.micOn;
      }
      options.onToggleMic?.();
    });

    // 5. Connect Duration Tracker ticks
    if (options.durationTracker) {
      const onTick = (stats: { elapsedMs: number }) => {
        if (this.timerEl) {
          this.timerEl.textContent = formatDuration(stats.elapsedMs / 1000);
        }
      };
      options.durationTracker.on('tick', onTick);
      this.unsubscribeTick = () => {
        options.durationTracker?.off('tick', onTick);
      };
    }

    // 6. Handle PiP window close (e.g. user clicks OS close button or dock button)
    const handleClose = () => {
      this.cleanup();
      options.onClose?.();
    };

    this.pipWindow.addEventListener('pagehide', handleClose, { once: true });
    this.pipWindow.addEventListener('unload', handleClose, { once: true });
  }

  updateState(state: 'recording' | 'paused'): void {
    if (!this.pauseBtn || !this.containerEl) return;
    if (state === 'paused') {
      this.pauseBtn.innerHTML = PIP_ICONS.play;
      this.pauseBtn.title = 'Resume Recording';
      this.containerEl.classList.add('sat-pip-paused');
    } else {
      this.pauseBtn.innerHTML = PIP_ICONS.pause;
      this.pauseBtn.title = 'Pause Recording';
      this.containerEl.classList.remove('sat-pip-paused');
    }
  }

  updateTimer(seconds: number): void {
    if (this.timerEl) {
      this.timerEl.textContent = formatDuration(seconds);
    }
  }

  updateMic(isMuted: boolean): void {
    this.isMutedMic = isMuted;
    if (this.micBtn) {
      this.micBtn.innerHTML = isMuted ? PIP_ICONS.micOff : PIP_ICONS.micOn;
    }
  }

  updateCameraMute(isMuted: boolean): void {
    this.isMutedCam = isMuted;
    if (this.camBtn) {
      this.camBtn.innerHTML = isMuted ? PIP_ICONS.camOff : PIP_ICONS.camOn;
    }
    const overlay = this.containerEl?.querySelector('.sat-pip-muted-overlay');
    if (overlay) {
      overlay.classList.toggle('is-active', isMuted);
    }
  }

  private cleanup(): void {
    if (this.unsubscribeTick) {
      this.unsubscribeTick();
      this.unsubscribeTick = undefined;
    }
    this.pipWindow = null;
    this.videoEl = undefined;
    this.timerEl = undefined;
    this.pauseBtn = undefined;
    this.micBtn = undefined;
    this.camBtn = undefined;
    this.containerEl = undefined;
  }

  close(): void {
    if (this.pipWindow && !this.pipWindow.closed) {
      try {
        this.pipWindow.close();
      } catch {}
    }
    this.cleanup();
  }
}
