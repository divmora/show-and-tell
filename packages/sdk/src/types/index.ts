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
export type RequestedRecordingMode = 'pixel' | 'dom' | 'auto';

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
  /** Record same-origin iframes embedded in the page (default: true) */
  recordIframes?: boolean;
  /** Listen for bridged cross-origin iframes via postMessage (default: true) */
  recordCrossOriginIframes?: boolean;
  /** Allowed origins for cross-origin iframes communicating via postMessage (default: all) */
  allowedIframeOrigins?: string[];
}

export interface IframeBridgeConfig {
  /** Whitelist of parent origins allowed to record this child iframe (e.g. ['https://app.example.com'], default: all) */
  allowedParentOrigins?: string[];
  /** Optional DOM recording configuration applied to this child frame */
  domConfig?: DomConfig;
  /** Timeslice interval in ms for streaming events to parent (default: 500) */
  timeslice?: number;
  /** Optional target window for tests or nested container communication (default: window.parent) */
  parentWindow?: Window;
}

export type IframeBridgeMessage =
  | { type: 'sat:ping' }
  | { type: 'sat:pong'; origin: string }
  | { type: 'sat:start'; config?: DomConfig; startTime?: number }
  | { type: 'sat:stop' }
  | { type: 'sat:snapshot'; data: SerializedNode; viewport: { width: number; height: number; scrollX: number; scrollY: number } }
  | { type: 'sat:chunk'; events: DomRecordingEvent[] };

export interface SerializedNode {
  id: number;
  type: 'element' | 'text' | 'comment';
  tagName?: string;
  attributes?: Record<string, string>;
  textContent?: string;
  children?: SerializedNode[];
  isInput?: boolean;
  value?: string | boolean;
  selectedIndex?: number;
  /** Serialized child document for same-origin or bridged <iframe> elements */
  contentDocument?: SerializedNode;
  /** Flagged true when an iframe is cross-origin */
  isCrossOrigin?: boolean;
  /** Flagged true when a cross-origin iframe has an active ShowAndTell bridge connection */
  isBridged?: boolean;
  /** Origin URL of the iframe (if available) */
  iframeOrigin?: string;
}

export type DomRecordingEvent = 
  | { type: 'dom_snapshot'; timestamp: number; data: SerializedNode; viewport: { width: number; height: number; scrollX: number; scrollY: number } }
  | { type: 'mutation'; timestamp: number; addedNodes?: { parentId: number; nextSiblingId?: number | null; node: SerializedNode }[]; removedNodeIds?: number[]; attributeChanges?: { nodeId: number; name: string; value: string | null }[]; textChanges?: { nodeId: number; value: string }[] }
  | { type: 'mouse_move'; timestamp: number; x: number; y: number }
  | { type: 'mouse_click'; timestamp: number; x: number; y: number; clickType: 'click' | 'mousedown' | 'mouseup' }
  | { type: 'scroll'; timestamp: number; x: number; y: number; targetId?: number }
  | { type: 'input'; timestamp: number; targetId: number; value: string | boolean; checked?: boolean; selectedIndex?: number }
  | { type: 'selection'; timestamp: number; ranges?: { startNodeId: number; startOffset: number; endNodeId: number; endOffset: number }[] }
  | { type: 'camera_position'; timestamp: number; x: number; y: number; width: number; height: number; shape: 'circle' | 'rect'; isMuted?: boolean }
  | { type: 'resize'; timestamp: number; width: number; height: number };

export interface AudioConfig {
  /** Capture microphone voiceover (default: false) */
  mic?: boolean;
  /** Capture system / tab audio if supported by browser (default: true) */
  system?: boolean;
}

export interface NetworkSanitizeRule {
  /** Additional header names to redact (case-insensitive) */
  headers?: string[];
  /** Additional JSON keys to redact recursively */
  jsonKeys?: string[];
  /** Additional query parameter keys to redact */
  queryParams?: string[];
}

export interface NetworkDiagnosticsConfig {
  /** Master toggle for network request tracking (default: true) */
  enabled?: boolean;
  /** Whether to capture request and response bodies for error requests (status >= 400) (default: true) */
  captureErrorBodies?: boolean;
  /** Whether to capture request and response bodies for successful requests (status < 400) (default: false) */
  captureSuccessBodies?: boolean;
  /** Master toggle to capture all bodies (success & error) (default: false) */
  captureBodies?: boolean;
  /** Maximum bytes to capture per body before truncation (default: 8192, 8 KB) */
  maxBodySize?: number;
  /** URL patterns or regexes to completely exclude from network capture */
  ignoreUrls?: (string | RegExp)[];
  /** Optional strict allow-list of domains to capture (e.g. ['api.myapp.com']) */
  allowedDomains?: string[];
  /** Custom redaction rules augmenting the built-in defaults */
  sanitizeRules?: NetworkSanitizeRule;
  /** Custom developer hook to inspect or mutate entry before it is saved (return null to drop) */
  sanitize?: (entry: NetworkDiagnosticEntry) => NetworkDiagnosticEntry | null;
}

export interface DiagnosticsConfig {
  /** Master switch to enable/disable diagnostics collection (default: true) */
  enabled?: boolean;
  /** Capture console.error, console.warn, console.info (default: true) */
  console?: boolean;
  /** Track failed or all network requests via fetch and XMLHttpRequest (default: true) */
  network?: boolean | NetworkDiagnosticsConfig;
  /** Capture uncaught window exceptions and unhandled promise rejections (default: true) */
  uncaughtErrors?: boolean;
  /** Maximum number of diagnostic entries to retain (default: 200) */
  maxEntries?: number;
}

export type DiagnosticLevel = 'error' | 'warn' | 'info';

export interface DiagnosticEntry {
  id: string;
  category: 'console' | 'network' | 'error';
  level: DiagnosticLevel;
  timestamp: number; // ms elapsed from recording start
  timestampMs?: number; // alias for timestamp
  message: string;
  source?: string;
  method?: string;
  url?: string;
  status?: number;
  statusText?: string;
  durationMs?: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: any;
  responseBody?: any;
  initiatorType?: 'fetch' | 'xhr';
  details?: {
    method?: string;
    url?: string;
    status?: number;
    statusText?: string;
    durationMs?: number;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    requestBody?: any;
    responseBody?: any;
    initiatorType?: 'fetch' | 'xhr';
    stack?: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    source?: string;
  };
}

export interface NetworkDiagnosticEntry extends DiagnosticEntry {
  category: 'network';
  method: string;
  url: string;
  status: number;
  statusText?: string;
  durationMs: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: any;
  responseBody?: any;
  initiatorType?: 'fetch' | 'xhr';
  isRedacted?: boolean;
}

export interface CameraConfig {
  /** Shape of the floating camera bubble: 'circle' | 'rect' (default: 'circle') */
  shape?: 'circle' | 'rect';
  /** Diameter or size in pixels (default: 160) */
  size?: number;
  /** Initial corner placement (default: 'bottom-left') */
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  /** Horizontally mirror webcam feed (default: true) */
  mirrored?: boolean;
  /** Composite camera bubble directly into recorded video stream via canvas (default: false, since floating DOM bubble is already captured directly by getDisplayMedia) */
  composite?: boolean;
  /** Always-on-top Document Picture-in-Picture floating window across all windows, applications, and tabs (default: true when supported and camera is enabled) */
  alwaysOnTop?: boolean;
}

export interface CursorEffectsConfig {
  /** Enable radial ripple animation on mouse clicks (default: true) */
  clickRipple?: boolean;
  /** Primary ripple color for left clicks (default: '#3b82f6') */
  rippleColor?: string;
  /** Ripple color for right clicks (default: '#f59e0b') */
  rightClickRippleColor?: string;
  /** Maximum diameter of the ripple in pixels (default: 64) */
  rippleSize?: number;
  /** Duration of ripple animation in milliseconds (default: 550) */
  rippleDurationMs?: number;
  /** Enable cursor spotlight dimming mode on start (default: false) */
  spotlight?: boolean;
  /** Radius of the spotlight illuminated circle in pixels (default: 90) */
  spotlightRadius?: number;
  /** Dimming overlay opacity between 0.0 and 1.0 (default: 0.45) */
  spotlightOpacity?: number;
  /** Color of the dimmed backdrop (default: 'rgba(0, 0, 0, 0.45)') */
  spotlightColor?: string;
  /** Whether to show an illuminated ring around the spotlight circle (default: true) */
  spotlightRing?: boolean;
}

export interface CountdownConfig {
  /** Duration in seconds for pre-recording countdown (default: 3) */
  seconds?: number;
  /** Whether to play synthetic Web Audio tick beeps on each second (default: true) */
  audio?: boolean;
  /** Custom label displayed above countdown number (default: 'Recording starts in...') */
  label?: string;
}

export interface AudioLevelData {
  /** Normalized audio volume from 0.0 (silence) to 1.0 (peak) */
  volume: number;
  /** 3-tier discrete level: 0 (silent), 1 (low/green), 2 (medium/amber), 3 (high/red) */
  level: 0 | 1 | 2 | 3;
}

export interface AudioMeterConfig {
  /** Enable live microphone audio VU meter (default: true) */
  enabled?: boolean;
  /** Enable silent microphone warning alert when mic is unmuted but silent for >5 seconds (default: true) */
  silentWarning?: boolean;
  /** Silence duration threshold in seconds before triggering silent mic warning (default: 5) */
  silentThresholdSeconds?: number;
}

export type ThemeMode = 'dark' | 'light' | 'auto';

export interface ThemeConfig {
  /** Color theme mode: 'dark' (default) | 'light' | 'auto' (respects OS prefers-color-scheme) */
  mode?: ThemeMode;
  /** Primary accent color for active buttons, highlights, progress indicators (default: '#2563eb') */
  primaryColor?: string;
  /** Primary accent hover color (default: auto-calculated or darker shade of primaryColor) */
  primaryHoverColor?: string;
  /** Primary contrast text color when on top of primaryColor (default: '#ffffff') */
  primaryContrastColor?: string;
  /** Custom font family stack across toolbar, modal, and banner */
  fontFamily?: string;
  /** Monospace font family stack for timers and technical metrics */
  fontMono?: string;
  /** Base border radius for cards, buttons, dialogs (e.g. '8px', '12px', '16px') */
  borderRadius?: string;
  /** Custom background color for widgets/dialogs */
  backgroundColor?: string;
  /** Custom surface/card background color */
  surfaceColor?: string;
  /** Custom primary text color */
  textColor?: string;
  /** Custom secondary/muted text color */
  textMutedColor?: string;
  /** Custom border color */
  borderColor?: string;
  /** Danger / Stop button color (default: '#ef4444') */
  dangerColor?: string;
  /** Warning / Pause color (default: '#eab308') */
  warningColor?: string;
  /** Success / Complete color (default: '#10b981') */
  successColor?: string;
  /** Arbitrary custom CSS variable overrides (e.g. { '--sat-primary': '#6366f1' }) */
  cssVariables?: Record<string, string>;
}

export interface ShowAndTellConfig {
  /** Recording mode: 'pixel' (screen capture, default), 'dom' (in-app session replay), or 'auto' (automatic detection based on device capabilities) */
  mode?: RequestedRecordingMode;
  /** Automatically fallback to DOM mode if screen capture (getDisplayMedia) is not supported in the current browser/device (e.g. iPhone / iOS browsers) */
  fallbackToDom?: boolean;
  /** DOM recording configuration (active when mode is 'dom') */
  dom?: DomConfig;
  /** Developer diagnostics & breadcrumb tracking (default: true) */
  diagnostics?: boolean | DiagnosticsConfig;
  /** Pre-recording 3-2-1 countdown timer before capture starts (default: 3 when UI enabled, 0 when headless or disabled) */
  countdown?: number | boolean | CountdownConfig;
  /** Picture-in-picture webcam facecam overlay (pixel mode) */
  camera?: boolean | CameraConfig;
  /** Live microphone VU meter and silent mic detection (default: true when mic is active) */
  audioMeter?: boolean | AudioMeterConfig;
  /** Custom theming and white-label styling across floating widget, modal, and banner */
  theme?: ThemeConfig;
  /** Always-on-top Document Picture-in-Picture floating window across all windows, applications, and tabs */
  alwaysOnTop?: boolean;
  /** Cursor interaction feedback effects (click ripple animations and cursor spotlight) (default: true) */
  cursorEffects?: boolean | CursorEffectsConfig;
  /** Shorthand to enable/disable click ripple animations (default: true) */
  clickRipple?: boolean;
  /** Shorthand to enable/disable cursor spotlight dimming mode (default: false) */
  spotlight?: boolean;
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
  /** Enable local IndexedDB persistence for reload recovery, or configure storage budget and TTL auto-pruning (default: true) */
  storage?: boolean | StorageConfig;
  /** Preferred default filename or prefix (default: 'recording') */
  filename?: string;
  /** Reload recovery behavior: 'banner' (default), 'auto-download', 'custom', or 'none' */
  onReloadRecovery?: 'banner' | 'auto-download' | 'custom' | 'none';
  /** Optional custom upload endpoint (backward-compatible) */
  uploadEndpoint?: string;
  /** Unified upload configuration (presigned cloud or server endpoint) */
  upload?: UploadConfig;
  /** Optional callback fired on progress updates */
  onProgress?: (stats: DurationStats) => void;
}

export interface PresignedUrlTarget {
  /** Signed upload URL */
  url: string;
  /** HTTP method (default: 'PUT') */
  method?: 'PUT' | 'POST';
  /** Optional custom headers (e.g. Content-Type, x-amz-acl, Authorization) */
  headers?: Record<string, string>;
  /** Optional form fields for S3 presigned POST policy uploads */
  fields?: Record<string, string>;
  /** Optional publicly accessible URL or key for sharing once uploaded */
  publicUrl?: string;
}

export interface PresignedUploadContext {
  /** Recording session ID */
  id: string;
  /** Output filename (e.g. 'recording_123.webm') */
  filename: string;
  /** File MIME type */
  mimeType: string;
  /** Total payload size in bytes */
  size: number;
  /** Recording duration in seconds */
  duration: number;
  /** Recording capture mode */
  mode: RecordingMode;
  /** Role of the file being uploaded */
  fileType: 'recording' | 'camera' | 'diagnostics';
}

export interface UploadProgress {
  /** Bytes loaded so far */
  loaded: number;
  /** Total bytes to upload */
  total: number;
  /** Upload completion percentage from 0 to 100 */
  percent: number;
  /** Role of the file being uploaded */
  fileType: 'recording' | 'camera' | 'diagnostics';
}

export interface PresignedUploadResult {
  /** Target upload details returned by getPresignedUrl */
  target: PresignedUrlTarget;
  /** HTTP response status code (e.g. 200, 204) */
  status: number;
  /** Response headers from the object store */
  headers: Record<string, string>;
  /** Public URL if provided by getPresignedUrl or server response */
  publicUrl?: string;
  /** Role of the file that was uploaded */
  fileType: 'recording' | 'camera' | 'diagnostics';
}

export interface PresignedUploadConfig {
  /** Function to fetch presigned upload parameters from the host backend */
  getPresignedUrl: (context: PresignedUploadContext) => Promise<PresignedUrlTarget>;
  /** Optional progress callback */
  onProgress?: (progress: UploadProgress) => void;
  /** Optional completion callback */
  onSuccess?: (result: PresignedUploadResult) => void;
  /** Optional error callback */
  onError?: (error: Error) => void;
}

export interface ServerUploadConfig {
  /** Server upload endpoint URL */
  endpoint: string;
  /** Fetch request options */
  options?: RequestInit;
  /** Optional completion callback */
  onSuccess?: (response: Response) => void;
  /** Optional error callback */
  onError?: (error: Error) => void;
}

export type UploadConfig = PresignedUploadConfig | ServerUploadConfig;

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
  /** Captured developer diagnostics events (console errors, failed network calls) */
  diagnostics?: DiagnosticEntry[];
  /** Synchronized camera video blob recorded during session (DOM or Pixel mode) */
  cameraBlob?: Blob;
  /** Blob object URL for camera video playback */
  cameraUrl?: string;
  /** Helper to trigger browser file download */
  download: (customFilename?: string) => void;
  /** Helper to download DOM replay as an offline self-contained HTML file (DOM mode) */
  downloadHtmlReplay?: (customFilename?: string) => void;
  /** Helper to download raw DOM event JSON (DOM mode) */
  downloadJson?: (customFilename?: string) => void;
  /** Helper to upload recording to a server endpoint */
  upload: (endpointUrl: string, options?: RequestInit) => Promise<Response>;
  /** Helper to upload recording directly to S3 / Cloudflare R2 / Supabase presigned URL with progress */
  uploadPresigned: (config: PresignedUploadConfig) => Promise<PresignedUploadResult>;
  /** Revoke Blob object URL to free memory */
  revoke: () => void;
  /** Optional trim range applied to this recording */
  trimRange?: TrimRange;
  /** Original untrimmed recording duration in seconds */
  originalDuration?: number;
  /** Trim this recording result to the specified in/out range in seconds */
  trim?: (inSeconds: number, outSeconds: number) => Promise<RecordingResult>;
}

export interface TrimRange {
  /** Start trim timestamp in seconds */
  inSeconds: number;
  /** End trim timestamp in seconds */
  outSeconds: number;
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
  /** Toggle cursor spotlight on/off. Returns new spotlight state */
  toggleSpotlight: () => boolean;
  /** Enable or disable cursor spotlight */
  setSpotlight: (enabled: boolean) => void;
  /** Check if cursor spotlight is currently active */
  isSpotlightActive: () => boolean;
  /** Trigger a click ripple animation at specified viewport coordinates */
  triggerClickRipple: (x: number, y: number, color?: string) => void;
  /** Get current audio meter level data */
  getAudioLevel?: () => AudioLevelData;
  /** Check if silent microphone warning is currently triggered */
  isSilentMicWarningActive?: () => boolean;
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
  | 'spotlightChange'
  | 'audioLevel'
  | 'silentMicWarning'
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
  /** Total bytes of all chunks stored for this session */
  totalBytes?: number;
  /** Total count of chunks stored for this session */
  chunkCount?: number;
}

export interface StorageConfig {
  /** Enable or disable local IndexedDB persistence (default: true) */
  enabled?: boolean;
  /** Maximum storage budget cap in bytes (default: 300 MB = 300 * 1024 * 1024) */
  maxStorageBytes?: number;
  /** Maximum age TTL in milliseconds before unsaved sessions expire (default: 7 * 24 * 60 * 60 * 1000 = 7 days) */
  maxAgeMs?: number;
  /** Automatically prune expired and over-budget sessions on init or recording start (default: true) */
  autoPrune?: boolean;
}

export interface StoragePruneOptions {
  /** Maximum storage budget cap in bytes (default: 300 MB) */
  maxStorageBytes?: number;
  /** Maximum age TTL in milliseconds before unsaved sessions expire (default: 7 days) */
  maxAgeMs?: number;
  /** Optional custom cutoff timestamp in milliseconds (default: Date.now() - maxAgeMs) */
  cutoffTime?: number;
}

export interface StoragePruneResult {
  /** IDs of sessions evicted during pruning */
  evictedSessionIds: string[];
  /** Total number of bytes freed from IndexedDB */
  freedBytes: number;
  /** Total number of bytes currently consumed across all remaining sessions */
  remainingBytes: number;
  /** Number of sessions removed due to TTL expiration (> 7 days) */
  expiredCount: number;
  /** Number of sessions removed due to storage budget cap (LRU eviction) */
  overBudgetCount: number;
}

export interface StorageStats {
  /** Total bytes consumed by stored chunks */
  totalBytes: number;
  /** Total number of stored sessions */
  sessionCount: number;
  /** Total number of chunks stored */
  chunkCount: number;
  /** Oldest session timestamp */
  oldestSessionTime?: number;
  /** Newest session timestamp */
  newestSessionTime?: number;
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
