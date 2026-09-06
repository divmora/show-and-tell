import { 
  DiagnosticEntry,
  DiscontinueReason, 
  DomRecordingEvent,
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
import { DomRecorder } from '../dom/recorder';
import { DiagnosticsCollector } from '../diagnostics/collector';
import { CameraBubble } from '../camera/bubble';
import { VideoCompositor } from '../camera/compositor';
import { PipController } from '../ui/pip-controller';
import { formatDuration } from '../utils/time';

export class RecorderEngine {
  private activeSession?: RecordingSessionImpl;
  private activeConfig: ShowAndTellConfig = {};
  private mediaRecorder?: MediaRecorder;
  private domRecorder?: DomRecorder;
  private pipController?: PipController;
  private originalDocumentTitle?: string;
  private domEvents: DomRecordingEvent[] = [];
  private displayStream?: MediaStream;
  private micStream?: MediaStream;
  private cameraStream?: MediaStream;
  private cameraBubble?: CameraBubble;
  private cameraMediaRecorder?: MediaRecorder;
  private cameraChunks: Blob[] = [];
  private cameraBlob?: Blob;
  private cameraUrl?: string;
  private videoCompositor?: VideoCompositor;
  private diagnosticsCollector?: DiagnosticsCollector;
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

    this.activeConfig = config;
    const mode = config.mode || 'pixel';

    if (mode === 'pixel') {
      if (typeof window === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Screen capture (getDisplayMedia) is not supported in this browser or environment.');
      }
    } else {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        throw new Error('DOM recording is only supported in browser environments with a DOM window and document.');
      }
    }

    const sessionId = `sat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const mimeType = mode === 'dom' ? 'application/json' : getPreferredMimeType();
    const timeslice = config.timeslice ?? 1000;
    const shouldPersist = config.storage !== false;
    const hasMicConfig = typeof config.audio === 'object' ? !!config.audio.mic : false;
    const hasSystemAudio = typeof config.audio === 'object' ? config.audio.system !== false : config.audio !== false;
    const hasCameraConfig = !!config.camera;
    const cameraConfig = typeof config.camera === 'object' ? config.camera : {};
    const diagConfig = typeof config.diagnostics === 'object' ? config.diagnostics : {};
    const enableDiagnostics = config.diagnostics !== false;

    // Reset state
    this.chunks = [];
    this.domEvents = [];
    this.chunkIndex = 0;
    this.discontinueReason = 'user_stopped';

    // Start diagnostics collector if enabled
    if (enableDiagnostics) {
      this.diagnosticsCollector = new DiagnosticsCollector(diagConfig);
      this.diagnosticsCollector.start();
    }

    // ----------------------------------------------------
    // DOM Recording Mode (Zero Browser Permission Prompt)
    // ----------------------------------------------------
    if (mode === 'dom') {
      // Optional mic capture
      if (hasMicConfig && navigator.mediaDevices?.getUserMedia) {
        try {
          this.micStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          });
          this.audioMixer = new AudioMixer();
          this.audioMixer.mix(undefined, this.micStream);
        } catch (err) {
          console.warn('[ShowAndTell] Microphone capture denied or unavailable for DOM session:', err);
        }
      }

      // Optional camera bubble for local facecam preview & synchronized recording
      if (hasCameraConfig && navigator.mediaDevices?.getUserMedia) {
        try {
          this.cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: 'user'
            },
            audio: false
          });
          this.cameraBubble = new CameraBubble(this.cameraStream, cameraConfig);
          this.cameraBubble.mount();

          // Start recording camera stream for synchronized DOM replay
          try {
            const preferredMime = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp8'))
              ? 'video/webm;codecs=vp8'
              : 'video/webm';
            this.cameraChunks = [];
            this.cameraMediaRecorder = new MediaRecorder(this.cameraStream, { mimeType: preferredMime });
            this.cameraMediaRecorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) {
                this.cameraChunks.push(e.data);
              }
            };
            this.cameraMediaRecorder.start(timeslice);
          } catch (camRecErr) {
            console.warn('[ShowAndTell] Failed to start MediaRecorder for camera in DOM mode:', camRecErr);
          }
        } catch (err) {
          console.warn('[ShowAndTell] Camera capture denied or unavailable for DOM session:', err);
        }
      }

      // Initialize Duration Tracker
      this.durationTracker = new DurationTracker({
        maxDuration: config.maxDuration,
        warningThreshold: config.warningThreshold
      });

      // Initialize DOM Recorder
      this.domRecorder = new DomRecorder({
        config: config.dom,
        timeslice,
        onChunk: async (chunkEvents) => {
          const chunkJson = JSON.stringify(chunkEvents);
          const chunkBlob = new Blob([chunkJson], { type: 'application/json' });
          const index = this.chunkIndex++;
          this.chunks.push(chunkBlob);
          this.activeSession?.emit('chunk', chunkBlob, index);

          if (shouldPersist) {
            const stats = this.durationTracker?.getStats();
            await storage.saveChunk(sessionId, index, chunkBlob, stats?.elapsedMs ?? 0);
          }
        }
      });

      // Hook camera bubble state changes to domRecorder
      if (this.cameraBubble) {
        this.cameraBubble.onStateChange = (state) => {
          this.domRecorder?.recordCameraPosition(state);
        };
        this.domRecorder.recordCameraPosition(this.cameraBubble.getBubbleState());
      }

      // Initialize Session Controller
      this.activeSession = new RecordingSessionImpl({
        id: sessionId,
        mode: 'dom',
        mimeType: 'application/json',
        durationTracker: this.durationTracker,
        audioMixer: this.audioMixer,
        filename: config.filename,
        onStopRequest: () => this.stopInternal('user_stopped'),
        onPauseRequest: () => {
          this.domRecorder?.pause();
          if (this.cameraMediaRecorder && this.cameraMediaRecorder.state === 'recording') {
            try { this.cameraMediaRecorder.pause(); } catch {}
          }
          this.pipController?.updateState('paused');
          this.updateDocumentTitle(true, (this.durationTracker?.getStats().elapsedMs ?? 0) / 1000);
        },
        onResumeRequest: () => {
          this.domRecorder?.resume();
          if (this.cameraMediaRecorder && this.cameraMediaRecorder.state === 'paused') {
            try { this.cameraMediaRecorder.resume(); } catch {}
          }
          this.pipController?.updateState('recording');
          this.updateDocumentTitle(false, (this.durationTracker?.getStats().elapsedMs ?? 0) / 1000);
        }
      });

      // Save Session Metadata to IndexedDB for Reload Resilience
      if (shouldPersist) {
        await storage.createSession({
          id: sessionId,
          startTime: Date.now(),
          mimeType: 'application/json',
          mode: 'dom',
          maxDurationMs: this.durationTracker.getStats().maxDurationMs,
          elapsedMs: 0,
          status: 'active',
          filename: config.filename,
          updatedAt: Date.now()
        });

        this.beforeUnloadHandler = () => {
          if (this.domRecorder) {
            const events = this.domRecorder.getEvents();
            if (events.length > 0) {
              const dump = new Blob([JSON.stringify(events)], { type: 'application/json' });
              storage.saveChunk(sessionId, this.chunkIndex++, dump, this.durationTracker?.getStats().elapsedMs ?? 0);
            }
          }
        };
        window.addEventListener('beforeunload', this.beforeUnloadHandler);
        window.addEventListener('pagehide', this.beforeUnloadHandler);
      }

      // Max duration timeout
      this.durationTracker.on('timeout', () => {
        if (this.isRecording()) {
          this.stopInternal('max_duration_reached');
        }
      });

      this.durationTracker.on('tick', (stats) => {
        this.updateDocumentTitle(this.activeSession?.state === 'paused', stats.elapsedMs / 1000);
        if (config.onProgress) {
          config.onProgress(stats);
        }
      });

      this.setupMediaSession();

      // Start DOM recording and timer
      this.domRecorder.start();
      this.durationTracker.start();
      this.activeSession.state = 'recording';
      this.activeSession.emit('start');

      // Mount widget
      if (config.ui !== false) {
        this.widget = new RecordingWidget(this.activeSession, !!this.micStream);
        this.widget.onPopoutRequest = () => {
          this.openPipWindow();
        };
        this.widget.mount();
      }

      if (this.cameraBubble) {
        this.cameraBubble.onPopoutRequest = () => {
          this.openPipWindow();
        };
      }

      if ((config.alwaysOnTop === true || cameraConfig.alwaysOnTop === true) && PipController.isSupported()) {
        this.openPipWindow().catch(() => {});
      }

      return this.activeSession;
    }

    // ----------------------------------------------------
    // Pixel Recording Mode (getDisplayMedia Screen Capture)
    // ----------------------------------------------------
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

    // 2b. Request Camera Stream if requested
    if (hasCameraConfig && navigator.mediaDevices?.getUserMedia) {
      try {
        this.cameraStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          },
          audio: false
        });
        this.cameraBubble = new CameraBubble(this.cameraStream, cameraConfig);
        this.cameraBubble.mount();

        // In Pixel mode:
        // 1. If user records a specific Window or Browser Tab, the in-page DOM bubble is NOT part of that window/tab.
        //    Therefore, we MUST composite the camera onto the video stream so the webcam is visible in the recording!
        // 2. If composite is explicitly true, composite into the stream.
        const surface = this.displayStream.getVideoTracks()[0]?.getSettings()?.displaySurface;
        const isIsolatedSurface = surface === 'window' || surface === 'browser';
        const shouldComposite = cameraConfig.composite === true || (cameraConfig.composite !== false && isIsolatedSurface);

        if (shouldComposite) {
          this.videoCompositor = new VideoCompositor(
            this.displayStream,
            this.cameraStream,
            () => this.cameraBubble!.getBubbleState()
          );
        }
      } catch (err) {
        console.warn('[ShowAndTell] Camera capture denied or unavailable:', err);
      }
    }

    // 3. Audio Mixing
    this.audioMixer = new AudioMixer();
    const mixedAudioTracks = this.audioMixer.mix(this.displayStream, this.micStream);

    // 4. Create Combined MediaStream
    let videoStreamToRecord = this.displayStream;
    if (this.videoCompositor) {
      videoStreamToRecord = this.videoCompositor.start();
    }
    const videoTracks = videoStreamToRecord.getVideoTracks();
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
        this.pipController?.updateState('paused');
        this.updateDocumentTitle(true, (this.durationTracker?.getStats().elapsedMs ?? 0) / 1000);
      },
      onResumeRequest: () => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
          this.mediaRecorder.resume();
        }
        this.pipController?.updateState('recording');
        this.updateDocumentTitle(false, (this.durationTracker?.getStats().elapsedMs ?? 0) / 1000);
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

    this.durationTracker.on('tick', (stats) => {
      this.updateDocumentTitle(this.activeSession?.state === 'paused', stats.elapsedMs / 1000);
      if (config.onProgress) {
        config.onProgress(stats);
      }
    });

    this.setupMediaSession();

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
      this.widget.onPopoutRequest = () => {
        this.openPipWindow();
      };
      this.widget.mount();
    }

    if (this.cameraBubble) {
      this.cameraBubble.onPopoutRequest = () => {
        this.openPipWindow();
      };
    }

    if ((config.alwaysOnTop === true || cameraConfig.alwaysOnTop === true) && PipController.isSupported()) {
      this.openPipWindow().catch(() => {});
    }

    return this.activeSession;
  }

  private async openPipWindow(): Promise<void> {
    if (!PipController.isSupported() || !this.activeSession) return;
    if (!this.pipController) {
      this.pipController = new PipController();
    }
    if (this.pipController.isActive()) return;

    await this.pipController.open({
      session: this.activeSession,
      durationTracker: this.durationTracker,
      cameraStream: this.cameraStream,
      micStream: this.micStream,
      cameraConfig: typeof this.activeConfig.camera === 'object' ? this.activeConfig.camera : {},
      hasMic: !!this.micStream,
      onClose: () => {
        // When PiP window is closed/docked, restore in-page widget & camera bubble
        this.widget?.show();
        this.cameraBubble?.show();
      },
      onToggleMic: () => {
        return this.activeSession?.toggleMic() ?? false;
      },
      onToggleCamera: () => {
        return true;
      },
      onStateChange: (state) => {
        if (this.domRecorder) {
          this.domRecorder.recordCameraPosition(state);
        }
      }
    });

    if (this.pipController.isActive()) {
      // Hide in-page widget & camera bubble to prevent duplicate UI
      this.widget?.hide();
      this.cameraBubble?.hide();
    }
  }

  private updateDocumentTitle(isPaused: boolean, elapsedSec: number): void {
    if (typeof document === 'undefined') return;
    if (this.originalDocumentTitle === undefined) {
      this.originalDocumentTitle = document.title;
    }
    const icon = isPaused ? '⏸' : '🔴';
    const timeStr = formatDuration(elapsedSec);
    document.title = `${icon} ${timeStr} | Recording - ShowAndTell`;
  }

  private restoreDocumentTitle(): void {
    if (typeof document !== 'undefined' && this.originalDocumentTitle !== undefined) {
      document.title = this.originalDocumentTitle;
      this.originalDocumentTitle = undefined;
    }
  }

  private setupMediaSession(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !this.activeSession) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Screen Recording in Progress',
        artist: 'ShowAndTell'
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        this.activeSession?.pause();
      });
      navigator.mediaSession.setActionHandler('play', () => {
        this.activeSession?.resume();
      });
      navigator.mediaSession.setActionHandler('stop', () => {
        this.activeSession?.stop();
      });
    } catch {}
  }

  private clearMediaSession(): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('stop', null);
    } catch {}
  }

  private stopInternal(reason: DiscontinueReason): Promise<RecordingResult> {
    this.discontinueReason = reason;

    return new Promise<RecordingResult>((resolve) => {
      this.stopResolver = resolve;

      // Stop Duration Tracker
      this.durationTracker?.stop();

      // If DOM recording mode:
      if (this.domRecorder) {
        this.domEvents = this.domRecorder.stop();
        const fullJsonBlob = new Blob([JSON.stringify(this.domEvents)], { type: 'application/json' });
        this.chunks = [fullJsonBlob];

        if (this.cameraMediaRecorder && this.cameraMediaRecorder.state !== 'inactive') {
          this.cameraMediaRecorder.onstop = () => {
            if (this.cameraChunks.length > 0) {
              this.cameraBlob = new Blob(this.cameraChunks, {
                type: this.cameraMediaRecorder?.mimeType || 'video/webm'
              });
              this.cameraUrl = URL.createObjectURL(this.cameraBlob);
            }
            this.finalizeRecording(this.activeConfig);
          };
          try {
            this.cameraMediaRecorder.requestData();
          } catch {}
          this.cameraMediaRecorder.stop();
        } else {
          this.finalizeRecording(this.activeConfig);
        }
      } else if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        // Pixel mode: Request any final data and stop MediaRecorder
        try {
          this.mediaRecorder.requestData();
        } catch {}
        this.mediaRecorder.stop();
      } else {
        this.finalizeRecording(this.activeConfig);
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

    // Stop and collect diagnostics
    let diagnostics: DiagnosticEntry[] | undefined;
    if (this.diagnosticsCollector) {
      diagnostics = this.diagnosticsCollector.stop();
      this.diagnosticsCollector = undefined;
    }

    // Unmount Floating Widget
    if (this.widget) {
      this.widget.destroy();
      this.widget = undefined;
    }

    // Close Document PiP window if active
    if (this.pipController) {
      this.pipController.close();
      this.pipController = undefined;
    }
    this.restoreDocumentTitle();
    this.clearMediaSession();

    // Clean up camera bubble & compositor
    if (this.cameraBubble) {
      this.cameraBubble.destroy();
      this.cameraBubble = undefined;
    }
    if (this.videoCompositor) {
      this.videoCompositor.destroy();
      this.videoCompositor = undefined;
    }
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = undefined;
    }
    this.cameraMediaRecorder = undefined;
    this.cameraChunks = [];

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

    const result = session.createResult(
      this.chunks,
      this.discontinueReason,
      this.domEvents,
      diagnostics,
      this.cameraBlob,
      this.cameraUrl
    );
    this.cameraBlob = undefined;
    this.cameraUrl = undefined;

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

    this.domRecorder = undefined;
    this.activeSession = undefined;
  }
}

export const recorderEngine = new RecorderEngine();
