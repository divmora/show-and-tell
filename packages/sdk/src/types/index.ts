export type RecordingState = 
  | 'idle'
  | 'starting'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'error';

export type DiscontinueReason = 
  | 'user_stopped'
  | 'max_duration_reached'
  | 'track_ended'
  | 'reload_recovery'
  | 'error';

export interface AudioConfig {
  /** Capture microphone voiceover (default: false) */
  mic?: boolean;
  /** Capture system / tab audio if supported by browser (default: true) */
  system?: boolean;
}

export interface ShowAndTellConfig {
  /** Maximum recording duration in seconds (e.g. 120) or string format (e.g. '2m', '30s', '1h'). Recording will automatically discontinue after this time. */
  maxDuration?: number | string;
  /** Threshold in seconds before maxDuration to trigger warning indicators (default: 10s). */
  warningThreshold?: number;
  /** Audio capture options or boolean (default: { mic: false, system: true }) */
  audio?: boolean | AudioConfig;
  /** Optional video track constraints */
  video?: boolean | MediaTrackConstraints;
  /** Show floating on-screen recording toolbar widget (default: true) */
  ui?: boolean;
  /** Automatically open preview modal upon recording completion (default: true) */
  previewModal?: boolean;
  /** Timeslice interval in milliseconds for chunk generation (default: 1000) */
  timeslice?: number;
  /** Enable local IndexedDB persistence for reload recovery (default: true) */
  storage?: boolean;
  /** Preferred default filename or prefix (default: 'recording') */
  filename?: string;
  /** Reload recovery behavior: 'banner' (default), 'auto-download', 'custom', or 'none' */
  onReloadRecovery?: 'banner' | 'auto-download' | 'custom' | 'none';
  /** Optional custom upload endpoint */
  uploadEndpoint?: string;
  /** Optional callback fired on progress updates */
  onProgress?: (stats: DurationStats) => void;
}

export interface DurationStats {
  /** Total elapsed active recording time in milliseconds (excludes pause time) */
  elapsedMs: number;
  /** Total elapsed active recording time in seconds */
  elapsedSeconds: number;
  /** Formatted elapsed time (e.g. '01:23') */
  formattedElapsed: string;
  /** Maximum duration limit in milliseconds, if set */
  maxDurationMs?: number;
  /** Maximum duration limit in seconds, if set */
  maxDurationSeconds?: number;
  /** Formatted max duration (e.g. '05:00') */
  formattedMaxDuration?: string;
  /** Milliseconds remaining until maxDuration limit */
  remainingMs?: number;
  /** Seconds remaining until maxDuration limit */
  remainingSeconds?: number;
  /** Formatted remaining time (e.g. '00:30') */
  formattedRemaining?: string;
  /** Progress ratio from 0.0 to 1.0 */
  progressRatio?: number;
  /** Whether the timer is currently within the warning threshold */
  isWarning: boolean;
  /** Whether the recording is currently paused */
  isPaused: boolean;
}

export interface RecordingResult {
  /** Unique session ID */
  id: string;
  /** Generated video Blob */
  blob: Blob;
  /** Blob object URL for immediate playback in <video> elements */
  url: string;
  /** Final recording duration in seconds */
  duration: number;
  /** MIME type (e.g. 'video/webm;codecs=vp9,opus') */
  mimeType: string;
  /** Generated filename with proper extension */
  filename: string;
  /** Total file size in bytes */
  size: number;
  /** The reason why recording was discontinued */
  discontinueReason: DiscontinueReason;
  /** Helper to trigger browser file download */
  download: (customFilename?: string) => void;
  /** Helper to upload video to a server endpoint */
  upload: (endpointUrl: string, options?: RequestInit) => Promise<Response>;
  /** Revoke Blob object URL to free memory */
  revoke: () => void;
}

export interface RecordingSession {
  /** Unique session ID */
  id: string;
  /** Current recording state */
  readonly state: RecordingState;
  /** Get current duration & countdown statistics */
  getStats: () => DurationStats;
  /** Stop recording and retrieve final video result */
  stop: () => Promise<RecordingResult>;
  /** Pause recording (duration timer also pauses) */
  pause: () => void;
  /** Resume recording */
  resume: () => void;
  /** Mute microphone audio stream */
  muteMic: () => void;
  /** Unmute microphone audio stream */
  unmuteMic: () => void;
  /** Toggle mic mute state. Returns new muted state (true = muted) */
  toggleMic: () => boolean;
  /** Check if microphone is currently muted */
  isMicMuted: () => boolean;
  /** Subscribe to session events */
  on: (event: SessionEventName, handler: (...args: any[]) => void) => () => void;
  /** Unsubscribe from session events */
  off: (event: SessionEventName, handler: (...args: any[]) => void) => void;
}

export type SessionEventName = 
  | 'start'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'tick'
  | 'warning'
  | 'maxDurationReached'
  | 'chunk'
  | 'micMuteChange'
  | 'error';

export interface SessionMetadata {
  id: string;
  startTime: number;
  mimeType: string;
  maxDurationMs?: number;
  elapsedMs: number;
  status: 'active' | 'completed' | 'interrupted';
  filename?: string;
  updatedAt: number;
}

export interface ChunkRecord {
  id?: number;
  sessionId: string;
  index: number;
  blob: Blob;
  timestamp: number;
  elapsedMs: number;
}

export interface RecoverableSession {
  metadata: SessionMetadata;
  chunkCount: number;
  totalBytes: number;
  assemble: () => Promise<RecordingResult>;
  discard: () => Promise<void>;
}
