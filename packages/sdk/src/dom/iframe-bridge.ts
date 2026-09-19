import { DomConfig, DomRecordingEvent, IframeBridgeConfig, IframeBridgeMessage } from '../types';
import { DomRecorder } from './recorder';

export class IframeBridge {
  private recorder?: DomRecorder;
  private isRecording = false;
  private parentOrigin = '*';
  private cleanupFns: Array<() => void> = [];

  constructor(private config: IframeBridgeConfig = {}) {
    if (typeof window === 'undefined') return;

    const handleMessage = (e: MessageEvent) => {
      this.onMessage(e);
    };
    window.addEventListener('message', handleMessage);
    this.cleanupFns.push(() => window.removeEventListener('message', handleMessage));

    // Announce availability to parent window if embedded in an iframe or parentWindow configured
    const target = this.targetParent;
    if (target && (target !== window || this.config.parentWindow)) {
      try {
        target.postMessage({
          type: 'sat:pong',
          origin: window.location.origin
        } as IframeBridgeMessage, '*');
      } catch {}
    }
  }

  private get targetParent(): Window | null {
    if (this.config.parentWindow) return this.config.parentWindow;
    if (typeof window !== 'undefined' && window.parent) return window.parent;
    return null;
  }

  private isOriginAllowed(origin: string): boolean {
    if (!this.config.allowedParentOrigins || this.config.allowedParentOrigins.length === 0) {
      return true;
    }
    return this.config.allowedParentOrigins.includes(origin) || this.config.allowedParentOrigins.includes('*');
  }

  private onMessage(e: MessageEvent): void {
    if (!this.isOriginAllowed(e.origin)) return;

    const msg = e.data as IframeBridgeMessage;
    if (!msg || typeof msg !== 'object' || !('type' in msg)) return;

    if (msg.type === 'sat:ping') {
      this.parentOrigin = e.origin !== 'null' && e.origin ? e.origin : '*';
      this.postToParent({
        type: 'sat:pong',
        origin: window.location.origin
      });
    } else if (msg.type === 'sat:start') {
      this.parentOrigin = e.origin !== 'null' && e.origin ? e.origin : '*';
      this.start(msg.config, msg.startTime);
    } else if (msg.type === 'sat:stop') {
      this.stop();
    }
  }

  start(parentConfig?: DomConfig, _parentStartTime?: number): void {
    if (this.isRecording) return;
    this.isRecording = true;

    const effectiveConfig: DomConfig = {
      ...this.config.domConfig,
      ...parentConfig,
      recordIframes: false // Avoid recursive iframe recording inside child frame
    };

    this.recorder = new DomRecorder({
      config: effectiveConfig,
      timeslice: this.config.timeslice ?? 500,
      onChunk: (events: DomRecordingEvent[]) => {
        if (!this.isRecording) return;
        this.postToParent({
          type: 'sat:chunk',
          events
        });
      }
    });

    const initialEvents = this.recorder.start();
    const snapshot = initialEvents.find(ev => ev.type === 'dom_snapshot');
    if (snapshot && snapshot.type === 'dom_snapshot') {
      this.postToParent({
        type: 'sat:snapshot',
        data: snapshot.data,
        viewport: snapshot.viewport
      });
    }
  }

  stop(): void {
    if (!this.isRecording) return;
    this.isRecording = false;

    if (this.recorder) {
      const remainingEvents = this.recorder.stop();
      if (remainingEvents.length > 0) {
        this.postToParent({
          type: 'sat:chunk',
          events: remainingEvents
        });
      }
      this.recorder = undefined;
    }
  }

  destroy(): void {
    this.stop();
    this.cleanupFns.forEach(fn => fn());
    this.cleanupFns = [];
  }

  private postToParent(msg: IframeBridgeMessage): void {
    const parentWin = this.targetParent;
    if (!parentWin) return;
    try {
      parentWin.postMessage(msg, this.parentOrigin);
    } catch {}
  }
}

export function initIframeBridge(config?: IframeBridgeConfig): IframeBridge {
  return new IframeBridge(config);
}
