import { 
  DiscontinueReason, 
  DurationStats, 
  RecordingResult, 
  RecordingSession, 
  RecordingState, 
  SessionEventName 
} from '../types';
import { AudioMixer } from './audio-mixer';
import { DurationTracker } from './duration-tracker';
import { EventEmitter } from '../utils/event-emitter';
import { getExtensionForMimeType } from '../utils/codecs';

export interface SessionInitOptions {
  id: string;
  mimeType: string;
  durationTracker: DurationTracker;
  audioMixer: AudioMixer;
  filename?: string;
  onStopRequest: () => Promise<RecordingResult>;
  onPauseRequest: () => void;
  onResumeRequest: () => void;
}

export class RecordingSessionImpl extends EventEmitter<Record<SessionEventName, any[]>> implements RecordingSession {
  public readonly id: string;
  public state: RecordingState = 'idle';
  private mimeType: string;
  private durationTracker: DurationTracker;
  private audioMixer: AudioMixer;
  private defaultFilename: string;
  private onStopRequest: () => Promise<RecordingResult>;
  private onPauseRequest: () => void;
  private onResumeRequest: () => void;
  private stopPromise?: Promise<RecordingResult>;

  constructor(options: SessionInitOptions) {
    super();
    this.id = options.id;
    this.mimeType = options.mimeType;
    this.durationTracker = options.durationTracker;
    this.audioMixer = options.audioMixer;
    this.defaultFilename = options.filename || `recording_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    this.onStopRequest = options.onStopRequest;
    this.onPauseRequest = options.onPauseRequest;
    this.onResumeRequest = options.onResumeRequest;

    // Forward duration tracker events
    this.durationTracker.on('tick', (stats) => this.emit('tick', stats));
    this.durationTracker.on('warning', (stats) => this.emit('warning', stats));
    this.durationTracker.on('timeout', (stats) => this.emit('maxDurationReached', stats));
  }

  getStats(): DurationStats {
    return this.durationTracker.getStats();
  }

  async stop(): Promise<RecordingResult> {
    if (this.stopPromise) return this.stopPromise;
    if (this.state === 'stopped' || this.state === 'stopping') {
      throw new Error('Recording session has already stopped');
    }

    this.state = 'stopping';
    this.stopPromise = this.onStopRequest().then((res) => {
      this.state = 'stopped';
      this.emit('stop', res);
      return res;
    });

    return this.stopPromise;
  }

  pause(): void {
    if (this.state !== 'recording') return;
    this.state = 'paused';
    this.durationTracker.pause();
    this.onPauseRequest();
    this.emit('pause');
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'recording';
    this.durationTracker.resume();
    this.onResumeRequest();
    this.emit('resume');
  }

  muteMic(): void {
    this.audioMixer.setMicMuted(true);
    this.emit('micMuteChange', true);
  }

  unmuteMic(): void {
    this.audioMixer.setMicMuted(false);
    this.emit('micMuteChange', false);
  }

  toggleMic(): boolean {
    const isMuted = this.audioMixer.toggleMic();
    this.emit('micMuteChange', isMuted);
    return isMuted;
  }

  isMicMuted(): boolean {
    return this.audioMixer.isMicMuted();
  }

  /**
   * Constructs a standard RecordingResult object from final chunks.
   */
  createResult(chunks: Blob[], discontinueReason: DiscontinueReason): RecordingResult {
    const stats = this.durationTracker.getStats();
    const finalBlob = new Blob(chunks, { type: this.mimeType });
    const objectUrl = URL.createObjectURL(finalBlob);
    const ext = getExtensionForMimeType(this.mimeType);
    const filename = `${this.defaultFilename}.${ext}`;
    const duration = Math.max(1, stats.elapsedSeconds);

    const result: RecordingResult = {
      id: this.id,
      blob: finalBlob,
      url: objectUrl,
      duration,
      mimeType: this.mimeType,
      filename,
      size: finalBlob.size,
      discontinueReason,
      download: (customFilename?: string) => {
        const downloadName = customFilename || filename;
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = objectUrl;
        a.download = downloadName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (a.parentNode) a.parentNode.removeChild(a);
        }, 100);
      },
      upload: async (endpointUrl: string, options: RequestInit = {}) => {
        const formData = new FormData();
        formData.append('video', finalBlob, filename);
        formData.append('id', this.id);
        formData.append('duration', duration.toString());
        formData.append('mimeType', this.mimeType);
        formData.append('discontinueReason', discontinueReason);

        const res = await fetch(endpointUrl, {
          method: 'POST',
          body: formData,
          ...options
        });

        if (!res.ok) {
          throw new Error(`Upload failed with HTTP ${res.status}: ${res.statusText}`);
        }
        return res;
      },
      revoke: () => {
        URL.revokeObjectURL(objectUrl);
      }
    };

    return result;
  }
}
