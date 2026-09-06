import type { 
  RecoverableSession,
  RecordingResult,
  RecordingSession,
  ShowAndTellConfig,
  DomRecordingEvent
} from './types';
import { recorderEngine } from './core/recorder';
import { storage } from './storage/indexeddb';
import { RecoveryBanner } from './ui/recovery-banner';
import { getExtensionForMimeType } from './utils/codecs';
import { generateStandalonePlayerHtml } from './dom/standalone-player';

export * from './types';
export * from './dom';
export { AudioMixer } from './core/audio-mixer';
export { DurationTracker } from './core/duration-tracker';
export { storage, StorageManager } from './storage/indexeddb';
export { formatDuration, formatBytes, parseDurationToMs } from './utils/time';
export { getPreferredMimeType, getExtensionForMimeType } from './utils/codecs';

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
   * Initializes SDK and checks for interrupted recordings from previous reloads.
   */
  async init(config: { onReloadRecovery?: 'banner' | 'auto-download' | 'custom' | 'none' } = {}): Promise<void> {
    if (typeof window === 'undefined') return;

    const recoveryMode = config.onReloadRecovery ?? 'banner';
    if (recoveryMode === 'none') return;

    try {
      const recoverableList = await this.getInterruptedRecordings();
      if (recoverableList.length > 0) {
        const latest = recoverableList[recoverableList.length - 1];

        if (recoveryMode === 'banner') {
          const banner = new RecoveryBanner(latest);
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
