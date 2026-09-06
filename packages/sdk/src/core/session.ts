import { 
  DiagnosticEntry,
  DiscontinueReason, 
  DomRecordingEvent,
  DurationStats, 
  RecordingMode,
  RecordingResult, 
  RecordingSession, 
  RecordingState, 
  SessionEventName 
} from '../types';
import { AudioMixer } from './audio-mixer';
import { DurationTracker } from './duration-tracker';
import { EventEmitter } from '../utils/event-emitter';
import { getExtensionForMimeType } from '../utils/codecs';
import { generateStandalonePlayerHtml } from '../dom/standalone-player';

export interface SessionInitOptions {
  id: string;
  mimeType: string;
  mode?: RecordingMode;
  durationTracker: DurationTracker;
  audioMixer?: AudioMixer;
  filename?: string;
  onStopRequest: () => Promise<RecordingResult>;
  onPauseRequest: () => void;
  onResumeRequest: () => void;
}

export class RecordingSessionImpl extends EventEmitter<Record<SessionEventName, any[]>> implements RecordingSession {
  public readonly id: string;
  public readonly mode: RecordingMode;
  public state: RecordingState = 'idle';
  private mimeType: string;
  private durationTracker: DurationTracker;
  private audioMixer?: AudioMixer;
  private defaultFilename: string;
  private onStopRequest: () => Promise<RecordingResult>;
  private onPauseRequest: () => void;
  private onResumeRequest: () => void;
  private stopPromise?: Promise<RecordingResult>;

  constructor(options: SessionInitOptions) {
    super();
    this.id = options.id;
    this.mode = options.mode || 'pixel';
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
    if (this.audioMixer) {
      this.audioMixer.setMicMuted(true);
      this.emit('micMuteChange', true);
    }
  }

  unmuteMic(): void {
    if (this.audioMixer) {
      this.audioMixer.setMicMuted(false);
      this.emit('micMuteChange', false);
    }
  }

  toggleMic(): boolean {
    if (!this.audioMixer) return false;
    const isMuted = this.audioMixer.toggleMic();
    this.emit('micMuteChange', isMuted);
    return isMuted;
  }

  isMicMuted(): boolean {
    return this.audioMixer ? this.audioMixer.isMicMuted() : false;
  }

  /**
   * Constructs a standard RecordingResult object from final chunks and optional DOM events.
   */
  createResult(
    chunks: Blob[], 
    discontinueReason: DiscontinueReason, 
    domEvents?: DomRecordingEvent[],
    diagnostics?: DiagnosticEntry[],
    cameraBlob?: Blob,
    cameraUrl?: string
  ): RecordingResult {
    const stats = this.durationTracker.getStats();
    const finalBlob = new Blob(chunks, { type: this.mimeType });
    const objectUrl = URL.createObjectURL(finalBlob);
    const ext = this.mode === 'dom' ? 'json' : getExtensionForMimeType(this.mimeType);
    const filename = `${this.defaultFilename}.${ext}`;
    const duration = Math.max(1, stats.elapsedSeconds);

    const triggerDownload = (blobToDownload: Blob, name: string) => {
      const url = URL.createObjectURL(blobToDownload);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    };

    const result: RecordingResult = {
      id: this.id,
      mode: this.mode,
      blob: finalBlob,
      url: objectUrl,
      duration,
      mimeType: this.mimeType,
      filename,
      size: finalBlob.size,
      discontinueReason,
      domEvents,
      diagnostics,
      cameraBlob,
      cameraUrl,
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
        // Append both 'recording' and 'video' for backward compatibility
        formData.append('recording', finalBlob, filename);
        formData.append('video', finalBlob, filename);
        if (cameraBlob) {
          formData.append('camera', cameraBlob, `camera_${this.id}.webm`);
        }
        formData.append('id', this.id);
        formData.append('mode', this.mode);
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
        if (cameraUrl) {
          URL.revokeObjectURL(cameraUrl);
        }
      }
    };

    if (this.mode === 'dom') {
      result.downloadJson = (customFilename?: string) => {
        const jsonName = customFilename || `${this.defaultFilename}.json`;
        triggerDownload(finalBlob, jsonName);
      };

      result.downloadHtmlReplay = async (customFilename?: string) => {
        let cameraDataUri: string | undefined;
        if (cameraBlob) {
          try {
            cameraDataUri = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(cameraBlob);
            });
          } catch (e) {
            console.warn('[ShowAndTell] Failed to convert camera blob to data URL:', e);
          }
        }

        const htmlContent = generateStandalonePlayerHtml({
          events: domEvents || [],
          durationSeconds: duration,
          sessionId: this.id,
          title: `ShowAndTell Replay - ${this.defaultFilename}`,
          diagnostics,
          cameraDataUri
        });
        const htmlBlob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        const htmlName = customFilename || `${this.defaultFilename}.html`;
        triggerDownload(htmlBlob, htmlName);
      };
    }

    return result;
  }
}
