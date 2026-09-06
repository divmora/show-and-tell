export interface BubbleStateProvider {
  (): {
    x: number;
    y: number;
    size: number;
    width?: number;
    height?: number;
    shape: 'circle' | 'rect';
    isMuted: boolean;
    isMirrored: boolean;
  };
}

export class VideoCompositor {
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D | null;
  private screenVideo?: HTMLVideoElement;
  private cameraVideo?: HTMLVideoElement;
  private animationId?: number;
  private timerId?: number;
  private visibilityHandler?: () => void;
  private trackEndedHandler?: () => void;
  private compositedStream?: MediaStream;
  private isRunning = false;

  constructor(
    private displayStream: MediaStream,
    private cameraStream: MediaStream,
    private getBubbleState?: BubbleStateProvider
  ) {}

  start(): MediaStream {
    if (typeof document === 'undefined') return this.displayStream;

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });

    // Hidden video elements to consume media streams for canvas drawing
    this.screenVideo = document.createElement('video');
    this.screenVideo.autoplay = true;
    this.screenVideo.muted = true;
    this.screenVideo.playsInline = true;
    this.screenVideo.srcObject = this.displayStream;

    this.cameraVideo = document.createElement('video');
    this.cameraVideo.autoplay = true;
    this.cameraVideo.muted = true;
    this.cameraVideo.playsInline = true;
    this.cameraVideo.srcObject = this.cameraStream;

    this.screenVideo.play?.()?.catch?.(() => {});
    this.cameraVideo.play?.()?.catch?.(() => {});

    // Set initial canvas resolution from screen track settings
    const screenTrack = this.displayStream.getVideoTracks()[0];
    const settings = screenTrack?.getSettings();
    this.canvas.width = settings?.width || 1920;
    this.canvas.height = settings?.height || 1080;

    // React to visibility changes so background tabs don't stall recording
    this.visibilityHandler = () => {
      if (!this.isRunning) return;
      if (this.animationId !== undefined) {
        cancelAnimationFrame(this.animationId);
        this.animationId = undefined;
      }
      if (this.timerId !== undefined) {
        clearTimeout(this.timerId);
        this.timerId = undefined;
      }
      this.renderLoop();
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    if (screenTrack) {
      this.trackEndedHandler = () => {
        this.destroy();
      };
      screenTrack.addEventListener('ended', this.trackEndedHandler);
    }

    this.isRunning = true;
    this.renderLoop();

    this.compositedStream = this.canvas.captureStream(30);
    return this.compositedStream;
  }

  private renderLoop = (): void => {
    if (!this.isRunning || !this.ctx || !this.canvas || !this.screenVideo) return;

    if (this.screenVideo.paused) {
      this.screenVideo.play?.()?.catch?.(() => {});
    }
    if (this.cameraVideo && this.cameraVideo.paused) {
      this.cameraVideo.play?.()?.catch?.(() => {});
    }

    // Dynamically adjust canvas dimensions to match actual incoming video frames
    if (this.screenVideo.videoWidth && (this.canvas.width !== this.screenVideo.videoWidth || this.canvas.height !== this.screenVideo.videoHeight)) {
      this.canvas.width = this.screenVideo.videoWidth;
      this.canvas.height = this.screenVideo.videoHeight;
    }

    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. Draw Display / Screen Share Frame
    try {
      if (this.screenVideo.readyState >= 2) {
        this.ctx.drawImage(this.screenVideo, 0, 0, w, h);
      } else {
        this.ctx.fillStyle = '#0b0f19';
        this.ctx.fillRect(0, 0, w, h);
      }
    } catch {
      // Stream track might be in transition
    }

    // 2. Draw Camera Bubble Overlay
    if (this.cameraVideo && this.cameraVideo.readyState >= 2 && this.getBubbleState) {
      const state = this.getBubbleState();

      if (!state.isMuted) {
        const vw = window.innerWidth || 1280;
        const vh = window.innerHeight || 800;

        // Map window/screen client coordinates proportionally to canvas resolution
        const scaleX = w / vw;
        const scaleY = h / vh;
        const bubbleW = (state.width || state.size) * Math.min(scaleX, scaleY);
        const bubbleH = (state.height || state.size) * Math.min(scaleX, scaleY);
        const bubbleX = state.x * scaleX;
        const bubbleY = state.y * scaleY;
        const radius = Math.min(bubbleW, bubbleH) / 2;

        this.ctx.save();

        // Clip bubble path
        this.ctx.beginPath();
        if (state.shape === 'circle') {
          this.ctx.arc(bubbleX + radius, bubbleY + radius, radius, 0, Math.PI * 2);
        } else {
          // 16:9 widescreen rounded rectangle (Google Meet style)
          const cornerRadius = 12 * Math.min(scaleX, scaleY);
          this.drawRoundedRect(this.ctx, bubbleX, bubbleY, bubbleW, bubbleH, cornerRadius);
        }
        this.ctx.closePath();
        this.ctx.clip();

        // Draw camera frame (mirrored horizontally)
        if (state.isMirrored) {
          this.ctx.translate(bubbleX + bubbleW, bubbleY);
          this.ctx.scale(-1, 1);
          this.ctx.drawImage(this.cameraVideo, 0, 0, bubbleW, bubbleH);
        } else {
          this.ctx.drawImage(this.cameraVideo, bubbleX, bubbleY, bubbleW, bubbleH);
        }

        this.ctx.restore();

        // Draw border ring
        this.ctx.save();
        this.ctx.beginPath();
        if (state.shape === 'circle') {
          this.ctx.arc(bubbleX + radius, bubbleY + radius, radius - 1, 0, Math.PI * 2);
        } else {
          const cornerRadius = 12 * Math.min(scaleX, scaleY);
          this.drawRoundedRect(this.ctx, bubbleX, bubbleY, bubbleW, bubbleH, cornerRadius);
        }
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        this.ctx.lineWidth = Math.max(2, 3 * Math.min(scaleX, scaleY));
        this.ctx.stroke();
        this.ctx.restore();
      }
    }

    if (typeof document !== 'undefined' && document.hidden) {
      this.timerId = window.setTimeout(this.renderLoop, 1000 / 30);
    } else if (typeof requestAnimationFrame !== 'undefined') {
      this.animationId = requestAnimationFrame(this.renderLoop);
    } else {
      this.timerId = window.setTimeout(this.renderLoop, 1000 / 30);
    }
  };

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }

  destroy(): void {
    this.isRunning = false;
    if (this.animationId !== undefined) {
      cancelAnimationFrame(this.animationId);
      this.animationId = undefined;
    }
    if (this.timerId !== undefined) {
      clearTimeout(this.timerId);
      this.timerId = undefined;
    }
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = undefined;
    }
    if (this.trackEndedHandler) {
      const screenTrack = this.displayStream?.getVideoTracks?.()[0];
      screenTrack?.removeEventListener('ended', this.trackEndedHandler);
      this.trackEndedHandler = undefined;
    }
    if (this.screenVideo) {
      this.screenVideo.pause();
      this.screenVideo.srcObject = null;
      this.screenVideo = undefined;
    }
    if (this.cameraVideo) {
      this.cameraVideo.pause();
      this.cameraVideo.srcObject = null;
      this.cameraVideo = undefined;
    }
    if (this.compositedStream) {
      this.compositedStream.getTracks().forEach(t => t.stop());
      this.compositedStream = undefined;
    }
    this.canvas = undefined;
    this.ctx = undefined;
  }
}
