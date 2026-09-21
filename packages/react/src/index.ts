// Hooks
export { useShowAndTell } from './hooks/useShowAndTell';

// Context & Provider
export {
  ShowAndTellProvider,
  useShowAndTellContext,
  ShowAndTellContext
} from './context/ShowAndTellContext';

// Components
export { ShowAndTellButton } from './components/ShowAndTellButton';
export { ShowAndTellWidget } from './components/ShowAndTellWidget';

// React-specific Types
export type {
  UseShowAndTellOptions,
  UseShowAndTellReturn,
  ShowAndTellProviderProps,
  ShowAndTellWidgetProps,
  ShowAndTellButtonProps
} from './types';

// Re-export core SDK types and singleton for convenience
export {
  ShowAndTell,
  initIframeBridge,
  IframeBridge,
  HotkeyManager,
  DEFAULT_HOTKEYS,
  formatHotkeyLabel,
  TelestratorOverlay,
  DEFAULT_PALETTE_COLORS,
  type HotkeyConfig,
  type ShowAndTellConfig,
  type RecordingSession,
  type RecordingResult,
  type RecordingState,
  type DurationStats,
  type PresignedUploadConfig,
  type PresignedUploadResult,
  type RecordingMode,
  type IframeBridgeConfig,
  type IframeBridgeMessage,
  type TelestratorConfig,
  type DrawingTool,
  type DrawingPoint,
  type DrawingEventData
} from '@divmora/show-and-tell';
