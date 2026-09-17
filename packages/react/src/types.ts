import type React from 'react';
import type {
  ShowAndTellConfig,
  RecordingSession,
  RecordingResult,
  RecordingState,
  DurationStats
} from 'show-and-tell';

export interface UseShowAndTellOptions extends ShowAndTellConfig {
  /** Stop active recording automatically when component unmounts (default: false) */
  cleanupOnUnmount?: boolean;
  /** Callback invoked when recording starts */
  onStart?: (session: RecordingSession) => void;
  /** Callback invoked when recording stops and result is ready */
  onStop?: (result: RecordingResult) => void;
  /** Callback invoked on recording error */
  onError?: (error: Error) => void;
}

export interface UseShowAndTellReturn {
  /** Current recording state ('idle' | 'starting' | 'recording' | 'paused' | 'stopping' | 'stopped' | 'error') */
  state: RecordingState;
  /** True when recording is actively in progress (not paused) */
  isRecording: boolean;
  /** True when recording is currently paused */
  isPaused: boolean;
  /** True when recording is active (either recording or paused) */
  isActive: boolean;
  /** Real-time duration stats emitted every tick */
  stats: DurationStats | null;
  /** Formatted active duration (e.g. '01:23') */
  formattedElapsed: string;
  /** Formatted remaining duration if maxDuration is set (e.g. '00:37') */
  formattedRemaining?: string;
  /** Progress ratio between 0.0 and 1.0 if maxDuration is set */
  progressRatio?: number;
  /** True if within the warning threshold before max duration */
  isWarning: boolean;
  /** True if microphone voiceover is currently muted */
  isMicMuted: boolean;
  /** True if cursor spotlight dimming mode is currently active */
  isSpotlightActive: boolean;
  /** The currently active recording session object, or null */
  activeSession: RecordingSession | null;
  /** The most recent recording result, or null */
  lastResult: RecordingResult | null;
  /** Last error encountered during recording start/stop/runtime, or null */
  error: Error | null;
  /** Start a new recording session */
  startRecording: (overrideConfig?: ShowAndTellConfig) => Promise<RecordingSession>;
  /** Stop current recording and resolve result */
  stopRecording: () => Promise<RecordingResult>;
  /** Pause current recording */
  pauseRecording: () => void;
  /** Resume paused recording */
  resumeRecording: () => void;
  /** Toggle mic mute state. Returns new muted state */
  toggleMic: () => boolean;
  /** Mute microphone audio */
  muteMic: () => void;
  /** Unmute microphone audio */
  unmuteMic: () => void;
  /** Toggle cursor spotlight. Returns new active state */
  toggleSpotlight: () => boolean;
  /** Enable or disable cursor spotlight */
  setSpotlight: (enabled: boolean) => void;
  /** Trigger a click ripple animation at specified viewport coordinates */
  triggerClickRipple: (x: number, y: number, color?: string) => void;
  /** Reset error state */
  clearError: () => void;
}

export interface ShowAndTellProviderProps extends UseShowAndTellOptions {
  children: React.ReactNode;
}

export interface ShowAndTellWidgetProps {
  /** Configuration for the recording session */
  config?: ShowAndTellConfig;
  /** Callback when recording session starts */
  onStart?: (session: RecordingSession) => void;
  /** Callback when recording finishes and result is generated */
  onStop?: (result: RecordingResult) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /** Automatically trigger recording on mount (default: false) */
  autoStart?: boolean;
  /** Optional custom container class name */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
  /** Optional custom children trigger or render function */
  children?: React.ReactNode | ((state: UseShowAndTellReturn) => React.ReactNode);
}

export interface ShowAndTellButtonProps {
  /** ShowAndTell recording configuration */
  config?: ShowAndTellConfig;
  /** Callback when recording session starts */
  onStart?: (session: RecordingSession) => void;
  /** Callback when recording finishes and result is generated */
  onStop?: (result: RecordingResult) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /** Custom label when idle (default: 'Record Screen') */
  idleText?: string;
  /** Custom label when recording (default: 'Stop Recording') */
  recordingText?: string;
  /** Show live duration badge on button (default: true) */
  showTimer?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Optional CSS styles */
  style?: React.CSSProperties;
  /** Render prop for custom button layout */
  children?: (state: UseShowAndTellReturn) => React.ReactNode;
}
