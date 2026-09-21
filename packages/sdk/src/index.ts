import type { 
  RecoverableSession,
  RecordingResult,
  RecordingSession,
  ShowAndTellConfig,
  DomRecordingEvent,
  PresignedUploadConfig,
  PresignedUploadContext,
  PresignedUploadResult,
  RecordingMode,
  RequestedRecordingMode,
  ThemeConfig,
  StorageConfig,
  StoragePruneOptions,
  StoragePruneResult,
  StorageStats,
  DiagnosticEntry,
  NetworkDiagnosticEntry,
  IframeBridgeConfig,
  HotkeyConfig
} from './types';
import { recorderEngine, RecorderEngine } from './core/recorder';
import { storage } from './storage/indexeddb';
import { RecoveryBanner } from './ui/recovery-banner';
import { getExtensionForMimeType } from './utils/codecs';
import { generateStandalonePlayerHtml } from './dom/standalone-player';
import { initIframeBridge, IframeBridge } from './dom/iframe-bridge';
import { HotkeyManager } from './ui/hotkeys';
import { uploadRecordingAssets } from './utils/uploader';
import { exportToHar } from './diagnostics/sanitizer';

export * from './types';
export * from './dom';
export * from './editor';
export * from './diagnostics';
export * from './camera';
export { AudioMixer } from './core/audio-mixer';
export { AudioLevelMeter } from './core/audio-meter';
export { DurationTracker } from './core/duration-tracker';
export { RecorderEngine, recorderEngine } from './core/recorder';
export { storage, StorageManager, DEFAULT_MAX_STORAGE_BYTES, DEFAULT_MAX_AGE_MS } from './storage/indexeddb';
export { formatDuration, formatBytes, parseDurationToMs } from './utils/time';
export { getPreferredMimeType, getExtensionForMimeType } from './utils/codecs';
export { PipController } from './ui/pip-controller';
export { CursorEffectsManager } from './ui/cursor-effects';
export { TelestratorOverlay, DEFAULT_PALETTE_COLORS } from './ui/telestrator';
export { CountdownOverlay } from './ui/countdown';
export { uploadRecordingAssets, uploadBlobToPresignedTarget } from './utils/uploader';
export {
  THEME_CSS_VARS,
  resolveThemeMode,
  resolveThemeVariables,
  applyThemeToHost,
  DEFAULT_DARK_TOKENS,
  DEFAULT_LIGHT_TOKENS
} from './ui/theme';
export {
  HotkeyManager,
  DEFAULT_HOTKEYS,
  formatHotkeyLabel,
  parseHotkey,
  matchesHotkey,
  isEditableElement
} from './ui/hotkeys';

/**
 * Main ShowAndTell SDK object.
 */
export const ShowAndTell = {
  /**
   * Starts a new screen recording session.
   * Prompts user for screen / window capture, optional microphone, mixes audio, 
   * displays floating widget, and handles reload persistence.
   */
  async startRecording(config: ShowAndTellConfig = {}): Promise<RecordingSession> {
    return recorderEngine.startRecording(config);
  },

  /**
   * Stops the currently active recording session.
   * Returns the generated video Blob, download helper, and stats.
   */
  async stopRecording(): Promise<RecordingResult> {
    const session = recorderEngine.getActiveSession();
    if (!session) {
      throw new Error('No active recording session to stop.');
    }
    return session.stop();
  },

  /**
   * Discards the currently active recording session immediately without saving.
   */
  async discardRecording(): Promise<void> {
    const session = recorderEngine.getActiveSession();
    if (!session) return;
    return session.discard();
  },

  /**
   * Registers global keyboard shortcuts for starting, controlling, and stopping recordings.
   */
  registerHotkeys(config: HotkeyConfig = {}, onStart?: () => Promise<RecordingSession> | void): HotkeyManager {
    return RecorderEngine.registerHotkeys(config, onStart);
  },

  /**
   * Unregisters any active global keyboard shortcuts.
   */
  unregisterHotkeys(): void {
    RecorderEngine.unregisterHotkeys();
  },

  /**
   * Retrieves the currently active global hotkey manager, if registered.
   */
  getGlobalHotkeys(): HotkeyManager | undefined {
    return RecorderEngine.getGlobalHotkeys();
  },

  /**
   * Check if a screen recording is currently active or paused.
   */
  isRecording(): boolean {
    return recorderEngine.isRecording();
  },

  /**
   * Get the active recording session controller, if any.
   */
  getActiveSession(): RecordingSession | undefined {
    return recorderEngine.getActiveSession();
  },

  /**
   * Toggle telestrator drawing overlay mode on the active recording session.
   */
  toggleTelestrator(): boolean {
    const session = recorderEngine.getActiveSession();
    return session?.toggleTelestrator ? session.toggleTelestrator() : false;
  },

  /**
   * Clear all screen drawings and annotations on the active recording session.
   */
  clearDrawings(): void {
    const session = recorderEngine.getActiveSession();
    session?.clearDrawings?.();
  },

  /**
   * Dynamically updates the active visual theme tokens and mode.
   */
  setTheme(theme: ThemeConfig): void {
    recorderEngine.setTheme(theme);
  },

  /**
   * Check if screen capture or DOM session replay is supported in the current browser/device.
   */
  isSupported(mode?: RequestedRecordingMode): boolean {
    return RecorderEngine.isSupported(mode);
  },

  /**
   * Check if native screen capture (getDisplayMedia) is supported in the current browser.
   * Returns false on mobile browsers (e.g. iPhone Chrome/Safari, Android WebViews).
   */
  isScreenCaptureSupported(): boolean {
    return RecorderEngine.isScreenCaptureSupported();
  },

  /**
   * Check if in-app DOM session replay is supported in the current browser.
   */
  isDomRecordingSupported(): boolean {
    return RecorderEngine.isDomRecordingSupported();
  },

  /**
   * Retrieve an array of recording modes supported by the current browser environment.
   */
  getSupportedModes(): RecordingMode[] {
    return RecorderEngine.getSupportedModes();
  },

  /**
   * Detect whether current browser is running on a mobile OS (iOS, Android).
   */
  isMobile(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
  },

  /**
   * Find any unfinalized or interrupted recordings saved in IndexedDB from prior page reloads.
   */
  async getInterruptedRecordings(): Promise<RecoverableSession[]> {
    const sessions = await storage.getInterruptedSessions();
    const result: RecoverableSession[] = [];

    for (const session of sessions) {
      const chunks = await storage.getChunks(session.id);
      if (chunks.length === 0) continue;

      const totalBytes = chunks.reduce((acc, c) => acc + c.blob.size, 0);

      result.push({
        metadata: session,
        chunkCount: chunks.length,
        totalBytes,
        assemble: async () => {
          const assembled = await storage.assembleSessionBlob(session.id);
          if (!assembled) {
            throw new Error(`Failed to assemble chunks for session ${session.id}`);
          }
          const isDom = session.mode === 'dom' || assembled.mimeType === 'application/json';
          const ext = isDom ? 'json' : getExtensionForMimeType(assembled.mimeType);
          const filename = `${session.filename || 'recovered_recording'}_${session.id}.${ext}`;
          const objectUrl = URL.createObjectURL(assembled.blob);
          const duration = Math.max(1, Math.floor(session.elapsedMs / 1000));

          let domEvents: DomRecordingEvent[] | undefined;
          if (isDom) {
            try {
              const text = await assembled.blob.text();
              domEvents = JSON.parse(text);
            } catch {}
          }

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

          const recoveredResult: RecordingResult = {
            id: session.id,
            mode: isDom ? 'dom' : 'pixel',
            blob: assembled.blob,
            url: objectUrl,
            duration,
            mimeType: assembled.mimeType,
            filename,
            size: assembled.blob.size,
            discontinueReason: 'reload_recovery',
            domEvents,
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
              formData.append('recording', assembled.blob, filename);
              formData.append('video', assembled.blob, filename);
              formData.append('id', session.id);
              formData.append('mode', isDom ? 'dom' : 'pixel');
              formData.append('duration', duration.toString());
              formData.append('mimeType', assembled.mimeType);
              formData.append('discontinueReason', 'reload_recovery');

              const res = await fetch(endpointUrl, {
                method: 'POST',
                body: formData,
                ...options
              });
              return res;
            },
            uploadPresigned: async (config: PresignedUploadConfig): Promise<PresignedUploadResult> => {
              const primaryContext: PresignedUploadContext = {
                id: session.id,
                filename,
                mimeType: assembled.mimeType,
                size: assembled.blob.size,
                duration,
                mode: isDom ? 'dom' : 'pixel',
                fileType: 'recording'
              };

              const results = await uploadRecordingAssets({
                primaryBlob: assembled.blob,
                primaryContext,
                config
              });

              return results[0];
            },
            revoke: () => {
              URL.revokeObjectURL(objectUrl);
            }
          };

          if (isDom) {
            recoveredResult.downloadJson = (customFilename?: string) => {
              triggerDownload(assembled.blob, customFilename || `${session.filename || 'recovered_recording'}_${session.id}.json`);
            };
            recoveredResult.downloadHtmlReplay = (customFilename?: string) => {
              const htmlContent = generateStandalonePlayerHtml({
                events: domEvents || [],
                durationSeconds: duration,
                sessionId: session.id,
                title: `ShowAndTell Recovered Replay - ${session.id}`
              });
              const htmlBlob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
              triggerDownload(htmlBlob, customFilename || `${session.filename || 'recovered_recording'}_${session.id}.html`);
            };
          }

          return recoveredResult;
        },
        discard: async () => {
          await storage.deleteSession(session.id);
        }
      });
    }

    return result;
  },

  /**
   * Recovers an interrupted session by ID and returns its RecordingResult.
   */
  async recoverRecording(sessionId: string): Promise<RecordingResult> {
    const recoverableList = await this.getInterruptedRecordings();
    const target = recoverableList.find(r => r.metadata.id === sessionId);
    if (!target) {
      throw new Error(`No recoverable session found with ID "${sessionId}"`);
    }
    return target.assemble();
  },

  /**
   * Clears all stored recordings and chunks from IndexedDB.
   */
  async clearAllStorage(): Promise<void> {
    await storage.clearAll();
  },

  /**
   * Automatically prunes expired sessions (> 7 days TTL) and enforces storage budget caps via LRU eviction.
   */
  async pruneStorage(options?: StoragePruneOptions): Promise<StoragePruneResult> {
    return storage.pruneStorage(options);
  },

  /**
   * Retrieves aggregate storage usage statistics across IndexedDB.
   */
  async getStorageStats(): Promise<StorageStats> {
    return storage.getStorageStats();
  },

  /**
   * Generates an HTTP Archive (HAR 1.2) compliant object from diagnostic network entries.
   * Useful for exporting network logs directly to Chrome DevTools or Postman.
   */
  exportHar(entries?: DiagnosticEntry[]): object {
    const list: DiagnosticEntry[] = entries || recorderEngine.getDiagnostics();
    const netEntries = list.filter((e: DiagnosticEntry): e is NetworkDiagnosticEntry => e.category === 'network');
    return exportToHar(netEntries);
  },

  /**
   * Initializes a cross-origin DOM recording bridge when running inside an embedded iframe.
   * Enables secure postMessage relaying of DOM mutations, events, and snapshots to parent ShowAndTell.
   */
  initIframeBridge(config?: IframeBridgeConfig): IframeBridge {
    return initIframeBridge(config);
  },

  /**
   * Initializes SDK, checks for interrupted recordings from previous reloads,
   * and automatically prunes expired storage.
   */
  async init(config: { 
    onReloadRecovery?: 'banner' | 'auto-download' | 'custom' | 'none'; 
    theme?: ThemeConfig;
    storage?: boolean | StorageConfig;
  } = {}): Promise<void> {
    if (typeof window === 'undefined') return;

    if (config.theme) {
      this.setTheme(config.theme);
    }

    // Auto-prune storage on init if enabled
    if (config.storage !== false) {
      const storageConfig = typeof config.storage === 'object' ? config.storage : {};
      if (storageConfig.autoPrune !== false) {
        storage.pruneStorage({
          maxStorageBytes: storageConfig.maxStorageBytes,
          maxAgeMs: storageConfig.maxAgeMs
        }).catch(() => {});
      }
    }

    const recoveryMode = config.onReloadRecovery ?? 'banner';
    if (recoveryMode === 'none') return;

    try {
      const recoverableList = await this.getInterruptedRecordings();
      if (recoverableList.length > 0) {
        const latest = recoverableList[recoverableList.length - 1];

        if (recoveryMode === 'banner') {
          const banner = new RecoveryBanner(latest, config.theme);
          banner.mount();
        } else if (recoveryMode === 'auto-download') {
          const res = await latest.assemble();
          res.download();
          await latest.discard();
        }
      }
    } catch (err) {
      console.warn('[ShowAndTell] Init check error:', err);
    }
  }
};

// Auto-bind to window.ShowAndTell in browser environments
if (typeof window !== 'undefined') {
  (window as any).ShowAndTell = ShowAndTell;

  // Auto initialize reload check if document is already ready or on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ShowAndTell.init();
    });
  } else {
    ShowAndTell.init();
  }
}

export default ShowAndTell;
