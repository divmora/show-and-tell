import { 
  DiscontinueReason, 
  RecordingResult, 
  RecordingSession, 
  ShowAndTellConfig 
} from '../types';
import { AudioMixer } from './audio-mixer';
import { DurationTracker } from './duration-tracker';
import { RecordingSessionImpl } from './session';
import { storage } from '../storage/indexeddb';
import { getPreferredMimeType } from '../utils/codecs';
import { RecordingWidget } from '../ui/widget';
import { PreviewModal } from '../ui/preview-modal';

export class RecorderEngine {
  private activeSession?: RecordingSessionImpl;
  private mediaRecorder?: MediaRecorder;
  private displayStream?: MediaStream;
  private micStream?: MediaStream;
  private combinedStream?: MediaStream;
  private audioMixer?: AudioMixer;
  private durationTracker?: DurationTracker;
  private widget?: RecordingWidget;
  private chunks: Blob[] = [];
  private chunkIndex = 0;
  private discontinueReason: DiscontinueReason = 'user_stopped';
  private stopResolver?: (result: RecordingResult) => void;
  private beforeUnloadHandler?: (e: BeforeUnloadEvent) => void;

  isRecording(): boolean {
    return !!this.activeSession && (this.activeSession.state === 'recording' || this.activeSession.state === 'paused');
  }

  getActiveSession(): RecordingSession | undefined {
    return this.activeSession;
  }

  async startRecording(config: ShowAndTellConfig = {}): Promise<RecordingSession> {
    if (this.isRecording()) {
      throw new Error('A recording session is already active. Stop the current recording before starting a new one.');
    }

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('Screen capture (getDisplayMedia) is not supported in this browser or environment.');
    }

    const sessionId = `sat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const mimeType = getPreferredMimeType();
    const timeslice = config.timeslice ?? 1000;
    const shouldPersist = config.storage !== false;
    const hasMicConfig = typeof config.audio === 'object' ? !!config.audio.mic : false;
    const hasSystemAudio = typeof config.audio === 'object' ? config.audio.system !== false : config.audio !== false;

    // Reset chunks
    this.chunks = [];
    this.chunkIndex = 0;
    this.discontinueReason = 'user_stopped';

    // 1. Request Display Stream (Screen Capture)
    try {
      this.displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: config.video ?? {
          displaySurface: 'monitor'
        },
        audio: hasSystemAudio
      });
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        throw new Error('Screen capture permission was denied by the user.');
      }
      throw err;
    }

    // 2. Request Mic Stream if requested
    if (hasMicConfig) {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (err) {
        console.warn('[ShowAndTell] Microphone capture denied or unavailable:', err);
      }
    }

    // 3. Audio Mixing
    this.audioMixer = new AudioMixer();
    const mixedAudioTracks = this.audioMixer.mix(this.displayStream, this.micStream);

    // 4. Create Combined MediaStream
    const videoTracks = this.displayStream.getVideoTracks();
    this.combinedStream = new MediaStream([
      ...videoTracks,
      ...mixedAudioTracks
    ]);

    // 5. Initialize Duration Tracker
    this.durationTracker = new DurationTracker({
      maxDuration: config.maxDuration,
      warningThreshold: config.warningThreshold
    });

    // 6. Initialize Session Controller
    this.activeSession = new RecordingSessionImpl({
      id: sessionId,
      mimeType,
      durationTracker: this.durationTracker,
      audioMixer: this.audioMixer,
      filename: config.filename,
      onStopRequest: () => this.stopInternal('user_stopped'),
      onPauseRequest: () => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.pause();
        }
      },
      onResumeRequest: () => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
          this.mediaRecorder.resume();
        }
      }
    });

    // 7. Save Session Metadata to IndexedDB for Reload Resilience
    if (shouldPersist) {
      await storage.createSession({
        id: sessionId,
        startTime: Date.now(),
        mimeType,
        maxDurationMs: this.durationTracker.getStats().maxDurationMs,
        elapsedMs: 0,
        status: 'active',
        filename: config.filename,
        updatedAt: Date.now()
      });

      // Handle browser page reload / tab close
      this.beforeUnloadHandler = () => {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          try {
            this.mediaRecorder.requestData();
          } catch {}
        }
      };
      window.addEventListener('beforeunload', this.beforeUnloadHandler);
      window.addEventListener('pagehide', this.beforeUnloadHandler);
    }

    // 8. Handle Browser Native "Stop Sharing" Bar
    if (videoTracks.length > 0) {
      videoTracks[0].onended = () => {
        if (this.isRecording()) {
          this.stopInternal('track_ended');
        }
      };
    }

    // 9. Handle Max Duration Timeout (Auto-Discontinue)
    this.durationTracker.on('timeout', () => {
      if (this.isRecording()) {
        this.stopInternal('max_duration_reached');
      }
    });

    // Optional progress callback
    if (config.onProgress) {
      this.durationTracker.on('tick', config.onProgress);
    }

    // 10. Initialize MediaRecorder
    this.mediaRecorder = new MediaRecorder(this.combinedStream, {
      mimeType
    });

    this.mediaRecorder.ondataavailable = async (event) => {
      if (event.data && event.data.size > 0) {
        const chunk = event.data;
        const index = this.chunkIndex++;
        this.chunks.push(chunk);

        this.activeSession?.emit('chunk', chunk, index);

        if (shouldPersist) {
          const stats = this.durationTracker?.getStats();
          await storage.saveChunk(sessionId, index, chunk, stats?.elapsedMs ?? 0);
        }
      }
    };

    this.mediaRecorder.onstop = async () => {
      await this.finalizeRecording(config);
    };

    this.mediaRecorder.onerror = (err) => {
      console.error('[ShowAndTell] MediaRecorder error:', err);
      this.activeSession?.emit('error', err);
    };

    // 11. Start MediaRecorder and Duration Clock
    this.mediaRecorder.start(timeslice);
    this.durationTracker.start();
    this.activeSession.state = 'recording';
    this.activeSession.emit('start');

    // 12. Mount Floating UI Widget (if enabled)
    if (config.ui !== false) {
      this.widget = new RecordingWidget(this.activeSession, !!this.micStream);
      this.widget.mount();
    }

    return this.activeSession;
  }

  private stopInternal(reason: DiscontinueReason): Promise<RecordingResult> {
    this.discontinueReason = reason;

    return new Promise<RecordingResult>((resolve) => {
      this.stopResolver = resolve;

      // Stop Duration Tracker
      this.durationTracker?.stop();

      // Request any final data and stop MediaRecorder
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        try {
          this.mediaRecorder.requestData();
        } catch {}
        this.mediaRecorder.stop();
      } else {
        this.finalizeRecording();
      }
    });
  }

  private async finalizeRecording(config: ShowAndTellConfig = {}): Promise<void> {
    // Clean up beforeunload listeners
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      window.removeEventListener('pagehide', this.beforeUnloadHandler);
      this.beforeUnloadHandler = undefined;
    }

    // Unmount Floating Widget
    if (this.widget) {
      this.widget.destroy();
      this.widget = undefined;
    }

    // Stop all media tracks (screen + mic)
    this.combinedStream?.getTracks().forEach(track => track.stop());
    this.displayStream?.getTracks().forEach(track => track.stop());
    this.micStream?.getTracks().forEach(track => track.stop());

    // Destroy audio mixer
    this.audioMixer?.destroy();
    this.audioMixer = undefined;

    // Create final Result
    const session = this.activeSession;
    if (!session) return;

    const result = session.createResult(this.chunks, this.discontinueReason);

    // Update IndexedDB state to completed
    if (config.storage !== false) {
      await storage.updateSession({
        id: session.id,
        status: 'completed',
        elapsedMs: result.duration * 1000
      });
    }

    // Mount Preview Modal if enabled
    if (config.previewModal !== false) {
      const modal = new PreviewModal(result, config.uploadEndpoint);
      modal.mount();
    }

    // Resolve stop promise
    if (this.stopResolver) {
      this.stopResolver(result);
      this.stopResolver = undefined;
    }

    this.activeSession = undefined;
  }
}

export const recorderEngine = new RecorderEngine();
