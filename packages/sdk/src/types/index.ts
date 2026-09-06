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

export type RecordingMode = 'pixel' | 'dom';

export interface DomConfig {
  /** Mask all form inputs and text areas (default: true) */
  maskAllInputs?: boolean;
  /** Mask all rendered text content on the page (default: false) */
  maskAllText?: boolean;
  /** Class name to mask text contents and inputs for PII protection (default: 'sat-mask') */
  maskTextClass?: string;
  /** Class name to explicitly allow/unmask inputs and text even when maskAll is true (default: 'sat-unmask') */
  unmaskClass?: string;
  /** Unified CSS selector to identify specific elements, text, or inputs to mask (e.g. '#aadhar, #pan, .govt-id, [name="aadhar"]') */
  maskSelector?: string;
  /** Unified CSS selector to identify specific elements, text, or inputs to NOT mask (e.g. '#search, .public-field') */
  unmaskSelector?: string;
  /** CSS selector specifically for inputs to mask (alias for maskSelector) */
  maskInputSelector?: string;
  /** CSS selector specifically for inputs to NOT mask (alias for unmaskSelector) */
  unmaskInputSelector?: string;
  /** CSS selector specifically for text elements to mask */
  maskTextSelector?: string;
  /** CSS selector specifically for text elements to NOT mask */
  unmaskTextSelector?: string;
  /** Class name for elements to exclude from recording (default: 'sat-block') */
  blockClass?: string;
  /** Track mouse cursor movements (default: true) */
  recordMouse?: boolean;
  /** Throttle interval for mouse movements in ms (default: 50) */
  mouseThrottleMs?: number;
}

export interface SerializedNode {
  id: number;
  type: 'element' | 'text' | 'comment';
  tagName?: string;
  attributes?: Record<string, string>;
  textContent?: string;
  children?: SerializedNode[];
  isInput?: boolean;
  value?: string | boolean;
}

export type DomRecordingEvent = 
  | { type: 'dom_snapshot'; timestamp: number; data: SerializedNode; viewport: { width: number; height: number; scrollX: number; scrollY: number } }
  | { type: 'mutation'; timestamp: number; addedNodes?: { parentId: number; nextSiblingId?: number | null; node: SerializedNode }[]; removedNodeIds?: number[]; attributeChanges?: { nodeId: number; name: string; value: string | null }[]; textChanges?: { nodeId: number; value: string }[] }
  | { type: 'mouse_move'; timestamp: number; x: number; y: number }
  | { type: 'mouse_click'; timestamp: number; x: number; y: number; clickType: 'click' | 'mousedown' | 'mouseup' }
  | { type: 'scroll'; timestamp: number; x: number; y: number; targetId?: number }
  | { type: 'input'; timestamp: number; targetId: number; value: string | boolean; checked?: boolean }
  | { type: 'resize'; timestamp: number; width: number; height: number };

export interface AudioConfig {
  /** Capture microphone voiceover (default: false) */
  mic?: boolean;
  /** Capture system / tab audio if supported by browser (default: true) */
  system?: boolean;
}

export interface ShowAndTellConfig {
  /** Recording mode: 'pixel' (screen/display capture, default) or 'dom' (in-app session replay) */
  mode?: RecordingMode;
  /** DOM recording configuration (active when mode is 'dom') */
  dom?: DomConfig;
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
  /** Recording mode used */
  mode: RecordingMode;
  /** Generated video or JSON Blob */
  blob: Blob;
  /** Blob object URL for immediate playback in <video> elements or fetch */
  url: string;
  /** Final recording duration in seconds */
  duration: number;
  /** MIME type (e.g. 'video/webm;codecs=vp9,opus' or 'application/json') */
  mimeType: string;
  /** Generated filename with proper extension */
  filename: string;
  /** Total file size in bytes */
  size: number;
  /** The reason why recording was discontinued */
  discontinueReason: DiscontinueReason;
  /** Recorded DOM events if mode was 'dom' */
  domEvents?: DomRecordingEvent[];
  /** Helper to trigger browser file download */
  download: (customFilename?: string) => void;
  /** Helper to download DOM replay as an offline self-contained HTML file (DOM mode) */
  downloadHtmlReplay?: (customFilename?: string) => void;
  /** Helper to download raw DOM event JSON (DOM mode) */
  downloadJson?: (customFilename?: string) => void;
  /** Helper to upload recording to a server endpoint */
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
  mode?: RecordingMode;
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
