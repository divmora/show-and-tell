import { 
  DiagnosticEntry,
  DiscontinueReason, 
  DomRecordingEvent,
  RecordingMode,
  RecordingResult, 
  RecordingSession, 
  RequestedRecordingMode,
  ShowAndTellConfig,
  ThemeConfig 
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
import { CursorEffectsManager } from '../ui/cursor-effects';
import { CountdownOverlay } from '../ui/countdown';
import { formatDuration } from '../utils/time';

export class RecorderEngine {
  private activeSession?: RecordingSessionImpl;
  private activeConfig: ShowAndTellConfig = {};
  private mediaRecorder?: MediaRecorder;
  private domRecorder?: DomRecorder;
  private pipController?: PipController;
  private cursorEffects?: CursorEffectsManager;
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

  static isScreenCaptureSupported(): boolean {
    return typeof window !== 'undefined' && typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function';
  }

  static isDomRecordingSupported(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined' && typeof MutationObserver !== 'undefined';
  }

  static isSupported(mode?: RequestedRecordingMode): boolean {
    if (mode === 'pixel') return RecorderEngine.isScreenCaptureSupported();
    if (mode === 'dom') return RecorderEngine.isDomRecordingSupported();
    return RecorderEngine.isScreenCaptureSupported() || RecorderEngine.isDomRecordingSupported();
  }

  static getSupportedModes(): RecordingMode[] {
    const modes: RecordingMode[] = [];
    if (RecorderEngine.isScreenCaptureSupported()) modes.push('pixel');
    if (RecorderEngine.isDomRecordingSupported()) modes.push('dom');
    return modes;
  }

  isRecording(): boolean {
    return !!this.activeSession && (this.activeSession.state === 'recording' || this.activeSession.state === 'paused');
  }

  getActiveSession(): RecordingSession | undefined {
    return this.activeSession;
  }

  private configuredTheme?: ThemeConfig;

  /**
   * Dynamically updates the theme across active recording UI components (widget, PiP, camera bubble).
   */
  setTheme(theme: ThemeConfig): void {
    this.configuredTheme = theme;
    if (this.activeConfig) {
      this.activeConfig.theme = theme;
    }
    this.widget?.setTheme(theme);
    this.cameraBubble?.setTheme(theme);
    this.pipController?.setTheme(theme);
  }

  async startRecording(config: ShowAndTellConfig = {}): Promise<RecordingSession> {
    if (this.isRecording()) {
      throw new Error('A recording session is already active. Stop the current recording before starting a new one.');
    }

    const effectiveTheme = config.theme ?? this.configuredTheme;
    this.activeConfig = {
      ...config,
      ...(effectiveTheme ? { theme: effectiveTheme } : {})
    };
    const isScreenCaptureSupported = RecorderEngine.isScreenCaptureSupported();
    const requestedMode = config.mode || 'pixel';
    let mode: RecordingMode;

    if (requestedMode === 'auto') {
      mode = isScreenCaptureSupported ? 'pixel' : 'dom';
    } else if (requestedMode === 'pixel') {
      if (!isScreenCaptureSupported) {
        if (config.fallbackToDom) {
          console.warn('[ShowAndTell] Screen capture (getDisplayMedia) is not supported in this browser/device (e.g. iPhone / iOS browsers). Automatically falling back to DOM mode.');
          mode = 'dom';
        } else {
          throw new Error(
            'Screen capture (getDisplayMedia) is not supported in this browser or environment (e.g. iPhone / iOS browsers). ' +
            'Use mode: "dom" or mode: "auto" (or pass fallbackToDom: true) to record sessions on mobile devices.'
          );
        }
      } else {
        mode = 'pixel';
      }
    } else {
      mode = 'dom';
    }

    if (mode === 'dom') {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        throw new Error('DOM recording is only supported in browser environments with a DOM window and document.');
      }
    }

    const sessionId = `sat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const mimeType = mode === 'dom' ? 'application/json' : getPreferredMimeType();
    const timeslice = config.timeslice ?? 1000;
    const shouldPersist = config.storage !== false && (typeof config.storage !== 'object' || config.storage.enabled !== false);
    if (shouldPersist) {
      const storageOptions = typeof config.storage === 'object' ? config.storage : {};
      if (storageOptions.autoPrune !== false) {
        storage.pruneStorage({
          maxStorageBytes: storageOptions.maxStorageBytes,
          maxAgeMs: storageOptions.maxAgeMs
        }).catch(() => {});
      }
    }
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
          const meterConfig = typeof config.audioMeter === 'object' ? config.audioMeter : {};
          this.audioMixer = new AudioMixer({
            enabled: config.audioMeter !== false,
            silentWarning: meterConfig.silentWarning !== false,
            silentThresholdSeconds: meterConfig.silentThresholdSeconds ?? 5
          });
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
          this.cameraBubble = new CameraBubble(this.cameraStream, cameraConfig, config.theme);
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
        },
        onToggleSpotlight: () => {
          return this.cursorEffects ? this.cursorEffects.toggleSpotlight() : false;
        },
        onSetSpotlight: (enabled: boolean) => {
          this.cursorEffects?.setSpotlight(enabled);
        },
        onIsSpotlightActive: () => {
          return this.cursorEffects ? this.cursorEffects.isSpotlightActive() : false;
        },
        onTriggerRipple: (x: number, y: number, color?: string) => {
          this.cursorEffects?.triggerRipple(x, y, color);
        }
      });

      // Save Session Metadata to IndexedDB for Reload Resilience
      if (shouldPersist) {
        await storage.createSession({
          id: sessionId,
          startTime: Date.now(),
          mimeType: 'application/json',
          maxDurationMs: this.durationTracker.getStats().maxDurationMs,
          elapsedMs: 0,
          status: 'active',
          filename: config.filename,
          mode: 'dom',
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

      // Pre-recording countdown overlay
      const proceed = await this.runCountdown(config);
      if (!proceed) {
        this.cleanup(sessionId);
        throw new Error('Recording cancelled by user during countdown');
      }

      // Start DOM recording and timer
      this.domRecorder.start();
      this.durationTracker.start();
      this.activeSession.state = 'recording';
      this.activeSession.emit('start');

      // Mount cursor effects (click ripple and spotlight)
      if (config.cursorEffects !== false) {
        const cursorConfig = typeof config.cursorEffects === 'object' ? config.cursorEffects : {};
        this.cursorEffects = new CursorEffectsManager(this.activeSession, {
          clickRipple: config.clickRipple ?? cursorConfig.clickRipple ?? true,
          spotlight: config.spotlight ?? cursorConfig.spotlight ?? false,
          ...cursorConfig
        });
        this.cursorEffects.mount();
      }

      // Mount widget
      if (config.ui !== false) {
        this.widget = new RecordingWidget(this.activeSession, !!this.micStream, config.theme);
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
        this.cameraBubble = new CameraBubble(this.cameraStream, cameraConfig, config.theme);
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
    const meterConfig = typeof config.audioMeter === 'object' ? config.audioMeter : {};
    this.audioMixer = new AudioMixer({
      enabled: config.audioMeter !== false,
      silentWarning: meterConfig.silentWarning !== false,
      silentThresholdSeconds: meterConfig.silentThresholdSeconds ?? 5
    });
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
      },
      onToggleSpotlight: () => {
        return this.cursorEffects ? this.cursorEffects.toggleSpotlight() : false;
      },
      onSetSpotlight: (enabled: boolean) => {
        this.cursorEffects?.setSpotlight(enabled);
      },
      onIsSpotlightActive: () => {
        return this.cursorEffects ? this.cursorEffects.isSpotlightActive() : false;
      },
      onTriggerRipple: (x: number, y: number, color?: string) => {
        this.cursorEffects?.triggerRipple(x, y, color);
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

    // 11. Pre-recording countdown overlay
    const proceed = await this.runCountdown(config);
    if (!proceed) {
      this.cleanup(sessionId);
      throw new Error('Recording cancelled by user during countdown');
    }

    // 12. Start MediaRecorder and Duration Clock
    this.mediaRecorder.start(timeslice);
    this.durationTracker.start();
    this.activeSession.state = 'recording';
    this.activeSession.emit('start');

    // 13. Mount cursor effects (click ripple and spotlight)
    if (config.cursorEffects !== false) {
      const cursorConfig = typeof config.cursorEffects === 'object' ? config.cursorEffects : {};
      this.cursorEffects = new CursorEffectsManager(this.activeSession, {
        clickRipple: config.clickRipple ?? cursorConfig.clickRipple ?? true,
        spotlight: config.spotlight ?? cursorConfig.spotlight ?? false,
        ...cursorConfig
      });
      this.cursorEffects.mount();
    }

    // 13. Mount Floating UI Widget (if enabled)
    if (config.ui !== false) {
      this.widget = new RecordingWidget(this.activeSession, !!this.micStream, config.theme);
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
      theme: this.activeConfig.theme,
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

  private async runCountdown(config: ShowAndTellConfig): Promise<boolean> {
    // Skip if UI is disabled (headless) or if countdown is explicitly 0 or false
    if (config.ui === false || config.countdown === false || config.countdown === 0) {
      return true;
    }

    let seconds = 3;
    let audio = true;
    let label = 'Recording starts in...';

    if (typeof config.countdown === 'number') {
      seconds = config.countdown;
    } else if (typeof config.countdown === 'object') {
      seconds = config.countdown.seconds ?? 3;
      audio = config.countdown.audio !== false;
      label = config.countdown.label || label;
    }

    if (seconds <= 0) return true;

    return CountdownOverlay.show({
      seconds,
      audio,
      label,
      theme: config.theme
    });
  }

  private cleanup(sessionId?: string): void {
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      window.removeEventListener('pagehide', this.beforeUnloadHandler);
      this.beforeUnloadHandler = undefined;
    }

    if (this.diagnosticsCollector) {
      this.diagnosticsCollector.stop();
      this.diagnosticsCollector = undefined;
    }

    if (this.widget) {
      this.widget.destroy();
      this.widget = undefined;
    }

    if (this.cursorEffects) {
      this.cursorEffects.destroy();
      this.cursorEffects = undefined;
    }

    if (this.pipController) {
      this.pipController.close();
      this.pipController = undefined;
    }

    this.restoreDocumentTitle();
    this.clearMediaSession();

    if (this.cameraBubble) {
      this.cameraBubble.destroy();
      this.cameraBubble = undefined;
    }
    if (this.videoCompositor) {
      this.videoCompositor.destroy();
      this.videoCompositor = undefined;
    }
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = undefined;
    }
    this.cameraMediaRecorder = undefined;
    this.cameraChunks = [];

    this.combinedStream?.getTracks().forEach((track) => track.stop());
    this.displayStream?.getTracks().forEach((track) => track.stop());
    this.micStream?.getTracks().forEach((track) => track.stop());

    this.combinedStream = undefined;
    this.displayStream = undefined;
    this.micStream = undefined;

    this.audioMixer?.destroy();
    this.audioMixer = undefined;

    this.domRecorder = undefined;
    this.mediaRecorder = undefined;
    this.chunks = [];
    this.domEvents = [];

    if (sessionId) {
      storage.deleteSession(sessionId).catch(() => {});
    }

    if (this.activeSession) {
      this.activeSession.state = 'stopped';
      this.activeSession = undefined;
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

    // Clean up cursor effects
    if (this.cursorEffects) {
      this.cursorEffects.destroy();
      this.cursorEffects = undefined;
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
    const shouldPersist = config.storage !== false && (typeof config.storage !== 'object' || config.storage.enabled !== false);
    if (shouldPersist) {
      await storage.updateSession({
        id: session.id,
        status: 'completed',
        elapsedMs: result.duration * 1000
      });
    }

    // Mount Preview Modal if enabled
    if (config.previewModal !== false) {
      const modal = new PreviewModal(result, config.upload || config.uploadEndpoint, config.theme);
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
