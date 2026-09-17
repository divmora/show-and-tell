export const WIDGET_STYLES = `
:host {
  all: initial;
  font-family: var(--sat-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
  font-size: 14px;
  line-height: 1.5;
  color: var(--sat-text, #ffffff);
  z-index: 2147483647;
  position: fixed;
}

* {
  box-sizing: border-box;
}

.sat-widget-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--sat-bg, rgba(24, 24, 27, 0.88));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--sat-border, rgba(255, 255, 255, 0.12));
  border-radius: var(--sat-radius-full, 9999px);
  padding: 8px 14px;
  box-shadow: var(--sat-shadow, 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5));
  user-select: none;
  cursor: default;
  transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
  max-width: 90vw;
}

.sat-widget-container.sat-warning {
  border-color: rgba(239, 68, 68, 0.6);
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.35);
  animation: sat-pulse-border 1.5s infinite;
}

.sat-widget-container.sat-paused {
  border-color: rgba(234, 179, 8, 0.5);
}

@keyframes sat-pulse-border {
  0%, 100% {
    border-color: rgba(239, 68, 68, 0.4);
  }
  50% {
    border-color: rgba(239, 68, 68, 0.9);
  }
}

.sat-drag-handle {
  cursor: grab;
  display: flex;
  align-items: center;
  color: var(--sat-text-muted, rgba(255, 255, 255, 0.4));
  padding: 2px 4px;
}

.sat-drag-handle:hover {
  color: var(--sat-text, rgba(255, 255, 255, 0.8));
}

.sat-drag-handle:active {
  cursor: grabbing;
}

.sat-status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sat-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: var(--sat-danger-border, #ef4444);
  animation: sat-dot-pulse 1.5s infinite;
}

.sat-paused .sat-dot {
  background-color: var(--sat-warning, #eab308);
  animation: none;
}

@keyframes sat-dot-pulse {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }
  70% {
    transform: scale(1.1);
    box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}

.sat-timer-group {
  display: flex;
  flex-direction: column;
  min-width: 65px;
}

.sat-timer-text {
  font-family: var(--sat-font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.5px;
  color: var(--sat-text, #f4f4f5);
}

.sat-warning .sat-timer-text {
  color: #f87171;
}

.sat-timer-sub {
  font-size: 10px;
  color: var(--sat-text-muted, rgba(255, 255, 255, 0.5));
  line-height: 1;
}

.sat-divider {
  width: 1px;
  height: 20px;
  background-color: var(--sat-border, rgba(255, 255, 255, 0.15));
  margin: 0 2px;
}

.sat-btn-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sat-btn {
  background: var(--sat-btn-bg, rgba(255, 255, 255, 0.08));
  border: 1px solid var(--sat-btn-border, rgba(255, 255, 255, 0.1));
  color: var(--sat-text, #ffffff);
  border-radius: var(--sat-radius-full, 9999px);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: all 0.15s ease;
  outline: none;
}

.sat-btn:hover {
  background: var(--sat-btn-hover, rgba(255, 255, 255, 0.2));
  transform: translateY(-1px);
}

.sat-btn:active {
  transform: translateY(0);
}

.sat-btn-stop {
  background: var(--sat-danger, #dc2626);
  border-color: var(--sat-danger-border, #ef4444);
  color: white;
}

.sat-btn-stop:hover {
  background: var(--sat-danger-hover, #b91c1c);
}

.sat-btn.sat-btn-active-toggle {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
  color: #f87171;
}

.sat-btn.sat-btn-active-spotlight {
  background: rgba(59, 130, 246, 0.3);
  border-color: var(--sat-primary, #3b82f6);
  color: var(--sat-primary-hover, #60a5fa);
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.35);
}

.sat-btn.sat-btn-pip {
  background: rgba(59, 130, 246, 0.15);
  border-color: var(--sat-primary, #3b82f6);
  color: var(--sat-primary-hover, #93c5fd);
}

.sat-btn.sat-btn-pip:hover {
  background: var(--sat-primary, #2563eb);
  border-color: var(--sat-primary-hover, #1d4ed8);
  color: var(--sat-primary-contrast, #ffffff);
}

/* Light mode overrides for widget */
:host([data-theme="light"]) .sat-drag-handle,
:host(.sat-theme-light) .sat-drag-handle {
  color: var(--sat-text-muted, rgba(0, 0, 0, 0.4));
}

:host([data-theme="light"]) .sat-drag-handle:hover,
:host(.sat-theme-light) .sat-drag-handle:hover {
  color: var(--sat-text, rgba(0, 0, 0, 0.8));
}

:host([data-theme="light"]) .sat-timer-text,
:host(.sat-theme-light) .sat-timer-text {
  color: var(--sat-text, #09090b);
}

:host([data-theme="light"]) .sat-timer-sub,
:host(.sat-theme-light) .sat-timer-sub {
  color: var(--sat-text-muted, #71717a);
}

:host([data-theme="light"]) .sat-divider,
:host(.sat-theme-light) .sat-divider {
  background-color: var(--sat-border, rgba(0, 0, 0, 0.12));
}

:host([data-theme="light"]) .sat-vu-bar,
:host(.sat-theme-light) .sat-vu-bar {
  background: rgba(0, 0, 0, 0.15);
}

:host([data-theme="light"]) .sat-silent-warning,
:host(.sat-theme-light) .sat-silent-warning {
  background: var(--sat-bg-solid, #ffffff);
  border: 1px solid rgba(245, 158, 11, 0.6);
  color: #d97706;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
}

.sat-icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.sat-mic-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  position: relative;
}

.sat-vu-meter {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 16px;
  padding: 0 2px;
  cursor: pointer;
}

.sat-vu-bar {
  width: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.2);
  transition: background-color 0.1s ease, box-shadow 0.1s ease;
}

.sat-vu-bar-1 {
  height: 5px;
}

.sat-vu-bar-2 {
  height: 9px;
}

.sat-vu-bar-3 {
  height: 14px;
}

/* Level 1: Low (Green) */
.sat-vu-meter[data-level="1"] .sat-vu-bar-1,
.sat-vu-meter[data-level="2"] .sat-vu-bar-1,
.sat-vu-meter[data-level="3"] .sat-vu-bar-1 {
  background: #22c55e;
  box-shadow: 0 0 4px rgba(34, 197, 94, 0.6);
}

/* Level 2: Medium (Amber / Yellow) */
.sat-vu-meter[data-level="2"] .sat-vu-bar-2,
.sat-vu-meter[data-level="3"] .sat-vu-bar-2 {
  background: #eab308;
  box-shadow: 0 0 5px rgba(234, 179, 8, 0.6);
}

/* Level 3: Peak / High (Red) */
.sat-vu-meter[data-level="3"] .sat-vu-bar-3 {
  background: #ef4444;
  box-shadow: 0 0 6px rgba(239, 68, 68, 0.7);
}

/* When muted */
.sat-vu-meter.is-muted .sat-vu-bar {
  background: rgba(255, 255, 255, 0.08) !important;
  box-shadow: none !important;
}

.sat-silent-warning {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(24, 24, 27, 0.96);
  border: 1px solid rgba(245, 158, 11, 0.5);
  color: #fbbf24;
  padding: 5px 12px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6);
  animation: sat-warning-pulse 2s infinite ease-in-out;
  pointer-events: none;
  z-index: 10;
}

.sat-silent-warning-icon {
  width: 14px;
  height: 14px;
  fill: currentColor;
  flex-shrink: 0;
}

@keyframes sat-warning-pulse {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(-2px); }
}
`;

export const MODAL_STYLES = `
:host {
  all: initial;
  font-family: var(--sat-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
  font-size: 14px;
  line-height: 1.5;
  color: var(--sat-modal-text, #18181b);
  z-index: 2147483647;
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

* {
  box-sizing: border-box;
}

.sat-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: sat-fade-in 0.2s ease-out;
}

.sat-modal-dialog {
  position: relative;
  background: var(--sat-modal-bg, #ffffff);
  border-radius: var(--sat-radius-lg, 16px);
  width: 90%;
  max-width: 640px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--sat-shadow, 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1));
  animation: sat-scale-up 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 1;
  transition: width 0.2s cubic-bezier(0.16, 1, 0.3, 1), height 0.2s cubic-bezier(0.16, 1, 0.3, 1), max-width 0.2s, max-height 0.2s, background-color 0.2s;
}

.sat-modal-dialog.sat-modal-dialog-maximized {
  width: 96vw;
  max-width: 96vw;
  height: 94vh;
  max-height: 94vh;
}

.sat-modal-dialog.sat-modal-dialog-maximized .sat-modal-body {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.sat-modal-dialog.sat-modal-dialog-maximized .sat-video-container {
  flex: 1;
  height: 100%;
  aspect-ratio: auto;
  min-height: 0;
}

.sat-modal-dialog.sat-modal-dialog-maximized .sat-dom-player-wrapper {
  flex: 1;
  height: 100%;
  min-height: 0;
}

.sat-modal-dialog.sat-modal-dialog-maximized .sat-dom-player-container {
  flex: 1;
  height: 100%;
  aspect-ratio: auto;
  min-height: 0;
}

@keyframes sat-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes sat-scale-up {
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.sat-modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--sat-modal-header-border, #f4f4f5);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sat-modal-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--sat-modal-text, #09090b);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sat-modal-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sat-maximize-btn {
  background: transparent;
  border: none;
  color: var(--sat-modal-text-muted, #71717a);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--sat-radius-sm, 6px);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.sat-maximize-btn:hover {
  background: var(--sat-btn-hover, #f4f4f5);
  color: var(--sat-modal-text, #18181b);
}

.sat-close-btn {
  background: transparent;
  border: none;
  color: var(--sat-modal-text-muted, #71717a);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--sat-radius-sm, 6px);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.sat-close-btn:hover {
  background: var(--sat-btn-hover, #f4f4f5);
  color: var(--sat-modal-text, #18181b);
}

.sat-modal-body {
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sat-video-container {
  width: 100%;
  background: #09090b;
  border-radius: 10px;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sat-video-container video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.sat-dom-player-wrapper {
  width: 100%;
  background: #09090b;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.sat-dom-player-container {
  width: 100%;
  aspect-ratio: 16 / 9;
  position: relative;
  background: #ffffff;
  overflow: hidden;
}

.sat-dom-player-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.sat-dom-player-container::-webkit-scrollbar-track {
  background: #09090b;
}

.sat-dom-player-container::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 4px;
}

.sat-dom-player-container::-webkit-scrollbar-thumb:hover {
  background: #475569;
}

.sat-dom-player-wrapper:fullscreen {
  width: 100vw;
  height: 100vh;
  border-radius: 0;
  display: flex;
  flex-direction: column;
}

.sat-dom-player-wrapper:fullscreen .sat-dom-player-container,
.sat-dom-player-wrapper:fullscreen .sat-video-container {
  flex: 1;
  height: calc(100vh - 46px);
  aspect-ratio: auto;
}

.sat-dom-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: #111827;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.sat-dom-btn {
  background: var(--sat-primary, #2563eb);
  color: var(--sat-primary-contrast, #ffffff);
  border: none;
  border-radius: var(--sat-radius-sm, 6px);
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  transition: background 0.15s;
}

.sat-dom-btn:hover {
  background: var(--sat-primary-hover, #1d4ed8);
}

.sat-scrubber-track-wrap {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.sat-dom-scrubber {
  width: 100%;
  accent-color: var(--sat-primary, #3b82f6);
  cursor: pointer;
  height: 5px;
  position: relative;
  z-index: 1;
}

.sat-timeline-markers {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  height: 14px;
  z-index: 2;
}

.sat-timeline-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 7px;
  height: 7px;
  border-radius: 50%;
  cursor: pointer;
  pointer-events: auto;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.sat-timeline-marker:hover {
  transform: translate(-50%, -50%) scale(1.8);
  z-index: 10;
}

.sat-marker-error {
  background-color: var(--sat-danger-border, #ef4444);
  box-shadow: 0 0 0 1.5px rgba(17, 24, 39, 0.9), 0 0 5px #ef4444;
}

.sat-marker-warn {
  background-color: var(--sat-warning, #f59e0b);
  box-shadow: 0 0 0 1.5px rgba(17, 24, 39, 0.9), 0 0 5px #f59e0b;
}

.sat-marker-info {
  background-color: #38bdf8;
  box-shadow: 0 0 0 1.5px rgba(17, 24, 39, 0.9), 0 0 5px #38bdf8;
}

.sat-marker-tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: #09090b;
  color: #f4f4f5;
  font-size: 11px;
  font-family: var(--sat-font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace);
  padding: 4px 8px;
  border-radius: var(--sat-radius-sm, 4px);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  z-index: 20;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sat-timeline-marker:hover .sat-marker-tooltip {
  opacity: 1;
}

/* Post-Recording Trimmer Styles */
.sat-trim-btn.active,
.sat-trim-toggle-btn.active {
  background: var(--sat-primary, #3b82f6) !important;
  color: var(--sat-primary-contrast, #ffffff) !important;
  border-color: var(--sat-primary-hover, #2563eb) !important;
}

.sat-trim-panel {
  background: rgba(15, 23, 42, 0.92);
  border-top: 1px solid var(--sat-modal-header-border, rgba(255, 255, 255, 0.12));
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: sat-fade-in 0.15s ease-out;
}

.sat-trim-track-wrap {
  position: relative;
  width: 100%;
  height: 28px;
  display: flex;
  align-items: center;
  user-select: none;
  cursor: pointer;
}

.sat-trim-track {
  position: relative;
  width: 100%;
  height: 12px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: var(--sat-radius-sm, 6px);
  overflow: visible;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.sat-trim-cut {
  position: absolute;
  top: 0;
  bottom: 0;
  background: repeating-linear-gradient(
    -45deg,
    rgba(239, 68, 68, 0.2),
    rgba(239, 68, 68, 0.2) 4px,
    rgba(239, 68, 68, 0.35) 4px,
    rgba(239, 68, 68, 0.35) 8px
  );
  pointer-events: none;
  border-radius: inherit;
}

.sat-trim-cut-left {
  left: 0;
}

.sat-trim-cut-right {
  right: 0;
}

.sat-trim-highlight {
  position: absolute;
  top: -2px;
  bottom: -2px;
  background: rgba(59, 130, 246, 0.25);
  border: 2px solid var(--sat-primary, #3b82f6);
  border-radius: var(--sat-radius-sm, 6px);
  pointer-events: none;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.35);
}

.sat-trim-handle {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 16px;
  height: 26px;
  background: var(--sat-primary, #3b82f6);
  border: 2px solid #ffffff;
  border-radius: var(--sat-radius-sm, 5px);
  cursor: ew-resize;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
  transition: transform 0.1s ease, background-color 0.15s ease;
  touch-action: none;
}

.sat-trim-handle:hover,
.sat-trim-handle.is-dragging {
  background: var(--sat-primary-hover, #2563eb);
  transform: translate(-50%, -50%) scale(1.15);
  z-index: 20;
}

.sat-trim-handle-grip {
  width: 2px;
  height: 12px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 1px;
}

.sat-trim-handle-badge {
  position: absolute;
  bottom: calc(100% + 5px);
  left: 50%;
  transform: translateX(-50%);
  background: #09090b;
  color: #ffffff;
  font-size: 10px;
  font-family: var(--sat-font-mono, monospace);
  padding: 2px 5px;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

.sat-trim-footer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.sat-trim-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.sat-trim-stat-pill {
  background: rgba(255, 255, 255, 0.08);
  color: var(--sat-modal-text-muted, #94a3b8);
  padding: 2px 7px;
  border-radius: 4px;
}

.sat-trim-stat-pill strong {
  color: var(--sat-modal-text, #ffffff);
}

.sat-trim-stat-active {
  background: rgba(59, 130, 246, 0.18);
  color: var(--sat-primary, #60a5fa);
  border: 1px solid rgba(59, 130, 246, 0.35);
}

.sat-trim-cut-info {
  font-size: 11px;
  color: #f59e0b;
}

.sat-trim-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sat-trim-act-btn {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.sat-trim-act-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

.sat-btn-download-full {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  font-size: 13px;
  padding: 8px 14px;
  border-radius: var(--sat-radius-sm, 6px);
  cursor: pointer;
  display: none;
}

.sat-btn-download-full:hover {
  background: rgba(255, 255, 255, 0.15);
}

/* Light mode overrides for trimmer */
:host([data-theme="light"]) .sat-trim-panel,
:host(.sat-theme-light) .sat-trim-panel {
  background: var(--sat-modal-card-bg, #f8fafc);
  border-top-color: var(--sat-modal-header-border, #e2e8f0);
}

:host([data-theme="light"]) .sat-trim-track,
:host(.sat-theme-light) .sat-trim-track {
  background: #e2e8f0;
  border-color: #cbd5e1;
}

:host([data-theme="light"]) .sat-trim-stat-pill,
:host(.sat-theme-light) .sat-trim-stat-pill {
  background: #e2e8f0;
  color: #475569;
}

:host([data-theme="light"]) .sat-trim-stat-pill strong,
:host(.sat-theme-light) .sat-trim-stat-pill strong {
  color: #0f172a;
}

:host([data-theme="light"]) .sat-trim-act-btn,
:host(.sat-theme-light) .sat-trim-act-btn {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #0f172a;
}

:host([data-theme="light"]) .sat-btn-download-full,
:host(.sat-theme-light) .sat-btn-download-full {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #0f172a;
}

.sat-video-timeline-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  background: #111827;
  border-radius: var(--sat-radius-md, 8px);
  margin-top: -6px;
}

.sat-video-timeline-track {
  position: relative;
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 3px;
  cursor: pointer;
}

.sat-video-timeline-progress {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 0%;
  background: var(--sat-primary, #3b82f6);
  border-radius: 3px;
  pointer-events: none;
}

.sat-video-timeline-time {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #94a3b8;
  min-width: 75px;
  text-align: center;
}

.sat-diagnostics-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  outline: none;
}

.sat-diagnostics-toggle-btn:hover {
  background: rgba(239, 68, 68, 0.22);
}

.sat-diagnostics-toggle-btn.has-no-errors {
  background: rgba(148, 163, 184, 0.1);
  color: #94a3b8;
  border-color: rgba(148, 163, 184, 0.25);
}

.sat-diagnostics-toggle-btn.is-active {
  background: #ef4444;
  color: #ffffff;
  border-color: #ef4444;
}

.sat-diagnostics-drawer {
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 240px;
  transition: all 0.2s ease;
}

.sat-diagnostics-drawer.sat-collapsed {
  display: none;
}

.sat-diag-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  font-size: 12px;
  color: #f1f5f9;
  gap: 8px;
}

.sat-diag-header-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.sat-diag-filters {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sat-diag-filter-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #94a3b8;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.sat-diag-filter-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.sat-diag-filter-btn.active {
  background: rgba(59, 130, 246, 0.25);
  color: #60a5fa;
  border-color: #3b82f6;
}

.sat-diag-search {
  background: #09090b;
  border: 1px solid #334155;
  color: #ffffff;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  outline: none;
  width: 120px;
}

.sat-diag-search:focus {
  border-color: #3b82f6;
}

.sat-diag-list {
  overflow-y: auto;
  padding: 4px 0;
  max-height: 180px;
  display: flex;
  flex-direction: column;
}

.sat-diag-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #cbd5e1;
  cursor: pointer;
  transition: background 0.1s;
  border-left: 3px solid transparent;
}

.sat-diag-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.sat-diag-item.sat-diag-active {
  background: rgba(59, 130, 246, 0.15);
}

.sat-diag-item-error {
  border-left-color: #ef4444;
}

.sat-diag-item-warn {
  border-left-color: #f59e0b;
}

.sat-diag-item-info {
  border-left-color: #38bdf8;
}

.sat-diag-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  text-transform: uppercase;
  flex-shrink: 0;
}

.sat-badge-error {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.sat-badge-warn {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.4);
}

.sat-badge-info {
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.4);
}

.sat-diag-time-btn {
  background: rgba(255, 255, 255, 0.08);
  color: #94a3b8;
  border: none;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 10px;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}

.sat-diag-time-btn:hover {
  color: #ffffff;
  background: #2563eb;
}

.sat-diag-content {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sat-diag-empty {
  padding: 16px;
  text-align: center;
  color: #64748b;
  font-size: 11px;
}

.sat-diag-action-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #e2e8f0;
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
}

.sat-diag-action-btn:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.3);
}

.sat-diag-method-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 3px;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.sat-method-get {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.4);
}

.sat-method-post {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.4);
}

.sat-method-put, .sat-method-patch {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.4);
}

.sat-method-delete {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.sat-net-status-pill {
  font-size: 9px;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 600;
}

.sat-status-2xx {
  color: #10b981;
}

.sat-status-3xx {
  color: #f59e0b;
}

.sat-status-4xx, .sat-status-5xx, .sat-status-0 {
  color: #ef4444;
}

.sat-net-inspector-container {
  margin: 6px 12px 10px 12px;
  padding: 10px 12px;
  background: #090d16;
  border: 1px solid #1e293b;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #cbd5e1;
}

.sat-net-inspector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.sat-net-inspector-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}

.sat-net-tab-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.sat-net-tab-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.sat-net-tab-btn.active {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border-color: #3b82f6;
}

.sat-net-tab-content {
  max-height: 140px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  padding: 8px;
  font-size: 10px;
  line-height: 1.4;
  word-break: break-all;
  white-space: pre-wrap;
}

.sat-net-headers-table {
  width: 100%;
  border-collapse: collapse;
}

.sat-net-headers-table td {
  padding: 3px 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 10px;
}

.sat-net-header-key {
  color: #94a3b8;
  font-weight: 600;
  width: 35%;
}

.sat-net-header-val {
  color: #e2e8f0;
}

.sat-redacted-pill {
  display: inline-block;
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.4);
  padding: 0 4px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 700;
}

.sat-dom-time {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #94a3b8;
  min-width: 75px;
  text-align: center;
}

.sat-dom-btn-secondary,
.sat-dom-speed {
  background: rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: background 0.15s, color 0.15s;
  outline: none;
}

.sat-dom-btn-secondary:hover,
.sat-dom-speed:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

.sat-badge-mode {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 9999px;
  text-transform: uppercase;
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.3);
  margin-left: 6px;
}

.sat-meta-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  background: var(--sat-modal-card-bg, #f8fafc);
  padding: 12px 16px;
  border-radius: var(--sat-radius-md, 10px);
  border: 1px solid var(--sat-modal-card-border, #e2e8f0);
}

.sat-meta-item {
  display: flex;
  flex-direction: column;
}

.sat-meta-label {
  font-size: 11px;
  color: var(--sat-modal-text-muted, #64748b);
  text-transform: uppercase;
  font-weight: 500;
}

.sat-meta-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--sat-modal-text, #0f172a);
}

.sat-modal-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--sat-modal-header-border, #f4f4f5);
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--sat-modal-footer-bg, #fafafa);
}

.sat-modal-footer-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  width: 100%;
}

.sat-upload-progress-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  background: var(--sat-modal-card-bg, #f1f5f9);
  border: 1px solid var(--sat-modal-card-border, #e2e8f0);
  border-radius: var(--sat-radius-md, 8px);
  padding: 8px 12px;
  font-size: 12px;
  animation: sat-fade-in 0.2s ease-out;
}

.sat-upload-status-text {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 500;
  color: var(--sat-modal-text, #334155);
}

.sat-upload-progress-track {
  width: 100%;
  height: 6px;
  background: #cbd5e1;
  border-radius: 3px;
  overflow: hidden;
}

.sat-upload-progress-fill {
  height: 100%;
  background: var(--sat-primary, #2563eb);
  border-radius: 3px;
  width: 0%;
  transition: width 0.15s ease-out, background-color 0.2s ease;
}

.sat-upload-progress-fill.is-complete {
  background: var(--sat-success, #10b981);
}

.sat-upload-feedback {
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sat-upload-error-msg {
  color: var(--sat-danger-border, #ef4444);
  font-weight: 500;
}

.sat-upload-success-link {
  color: var(--sat-primary, #2563eb);
  text-decoration: underline;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.sat-upload-copy-btn {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: var(--sat-radius-sm, 4px);
  padding: 2px 6px;
  font-size: 10px;
  color: #475569;
  cursor: pointer;
}

.sat-upload-copy-btn:hover {
  background: #f8fafc;
  color: #0f172a;
}

.sat-action-btn {
  padding: 8px 16px;
  border-radius: var(--sat-radius-md, 8px);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s;
  outline: none;
}

.sat-action-btn-secondary {
  background: var(--sat-modal-btn-sec-bg, #ffffff);
  border: 1px solid var(--sat-modal-btn-sec-border, #e4e4e7);
  color: var(--sat-modal-btn-sec-text, #27272a);
}

.sat-action-btn-secondary:hover {
  background: var(--sat-modal-btn-sec-hover, #f4f4f5);
}

.sat-action-btn-primary {
  background: var(--sat-primary, #2563eb);
  border: 1px solid var(--sat-primary-hover, #1d4ed8);
  color: var(--sat-primary-contrast, #ffffff);
}

.sat-action-btn-primary:hover {
  background: var(--sat-primary-hover, #1d4ed8);
}

/* Dark mode overrides for modal dialog */
:host([data-theme="dark"]) .sat-modal-dialog,
:host(.sat-theme-dark) .sat-modal-dialog {
  background: var(--sat-modal-bg, #18181b);
  color: var(--sat-modal-text, #f4f4f5);
  border: 1px solid var(--sat-border, rgba(255, 255, 255, 0.12));
}

:host([data-theme="dark"]) .sat-modal-header,
:host(.sat-theme-dark) .sat-modal-header {
  border-bottom: 1px solid var(--sat-modal-header-border, #27272a);
}

:host([data-theme="dark"]) .sat-modal-title,
:host(.sat-theme-dark) .sat-modal-title {
  color: var(--sat-modal-text, #f4f4f5);
}

:host([data-theme="dark"]) .sat-maximize-btn,
:host([data-theme="dark"]) .sat-close-btn,
:host(.sat-theme-dark) .sat-maximize-btn,
:host(.sat-theme-dark) .sat-close-btn {
  color: var(--sat-modal-text-muted, #a1a1aa);
}

:host([data-theme="dark"]) .sat-maximize-btn:hover,
:host([data-theme="dark"]) .sat-close-btn:hover,
:host(.sat-theme-dark) .sat-maximize-btn:hover,
:host(.sat-theme-dark) .sat-close-btn:hover {
  background: var(--sat-btn-hover, #27272a);
  color: var(--sat-modal-text, #ffffff);
}

:host([data-theme="dark"]) .sat-meta-grid,
:host(.sat-theme-dark) .sat-meta-grid {
  background: var(--sat-modal-card-bg, #27272a);
  border-color: var(--sat-modal-card-border, #3f3f46);
}

:host([data-theme="dark"]) .sat-meta-label,
:host(.sat-theme-dark) .sat-meta-label {
  color: var(--sat-modal-text-muted, #a1a1aa);
}

:host([data-theme="dark"]) .sat-meta-value,
:host(.sat-theme-dark) .sat-meta-value {
  color: var(--sat-modal-text, #f4f4f5);
}

:host([data-theme="dark"]) .sat-modal-footer,
:host(.sat-theme-dark) .sat-modal-footer {
  background: var(--sat-modal-footer-bg, #141416);
  border-top-color: var(--sat-modal-header-border, #27272a);
}

:host([data-theme="dark"]) .sat-action-btn-secondary,
:host(.sat-theme-dark) .sat-action-btn-secondary {
  background: var(--sat-modal-btn-sec-bg, #27272a);
  border-color: var(--sat-modal-btn-sec-border, #3f3f46);
  color: var(--sat-modal-btn-sec-text, #f4f4f5);
}

:host([data-theme="dark"]) .sat-action-btn-secondary:hover,
:host(.sat-theme-dark) .sat-action-btn-secondary:hover {
  background: var(--sat-modal-btn-sec-hover, #3f3f46);
}

:host([data-theme="dark"]) .sat-upload-progress-container,
:host(.sat-theme-dark) .sat-upload-progress-container {
  background: var(--sat-modal-card-bg, #27272a);
  border-color: var(--sat-modal-card-border, #3f3f46);
}

:host([data-theme="dark"]) .sat-upload-status-text,
:host(.sat-theme-dark) .sat-upload-status-text {
  color: var(--sat-modal-text, #e4e4e7);
}

:host([data-theme="dark"]) .sat-upload-copy-btn,
:host(.sat-theme-dark) .sat-upload-copy-btn {
  background: #18181b;
  border-color: #3f3f46;
  color: #a1a1aa;
}

:host([data-theme="dark"]) .sat-upload-copy-btn:hover,
:host(.sat-theme-dark) .sat-upload-copy-btn:hover {
  background: #27272a;
  color: #f4f4f5;
}
`;

export const BANNER_STYLES = `
:host {
  all: initial;
  font-family: var(--sat-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
  font-size: 13px;
  line-height: 1.4;
  color: var(--sat-text, #ffffff);
  z-index: 2147483647;
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
}

* {
  box-sizing: border-box;
}

.sat-banner {
  background: var(--sat-bg-solid, #18181b);
  border: 1px solid var(--sat-border, rgba(255, 255, 255, 0.15));
  border-radius: var(--sat-radius-md, 12px);
  padding: 12px 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: var(--sat-shadow, 0 10px 25px -5px rgba(0, 0, 0, 0.4));
  animation: sat-slide-down 0.3s ease-out;
  max-width: 90vw;
}

@keyframes sat-slide-down {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

.sat-banner-text {
  display: flex;
  flex-direction: column;
}

.sat-banner-title {
  font-weight: 600;
  color: var(--sat-text, #ffffff);
}

.sat-banner-desc {
  font-size: 12px;
  color: var(--sat-text-muted, #a1a1aa);
}

.sat-banner-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sat-banner-btn {
  padding: 6px 12px;
  border-radius: var(--sat-radius-sm, 6px);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  outline: none;
}

.sat-banner-btn-recover {
  background: var(--sat-primary, #2563eb);
  border: 1px solid var(--sat-primary-hover, #3b82f6);
  color: var(--sat-primary-contrast, #ffffff);
}

.sat-banner-btn-recover:hover {
  background: var(--sat-primary-hover, #1d4ed8);
}

.sat-banner-btn-discard {
  background: var(--sat-btn-bg, rgba(255, 255, 255, 0.1));
  border: 1px solid var(--sat-btn-border, rgba(255, 255, 255, 0.1));
  color: var(--sat-text-secondary, #d4d4d8);
}

.sat-banner-btn-discard:hover {
  background: var(--sat-btn-hover, rgba(255, 255, 255, 0.2));
}

/* Light mode overrides for recovery banner */
:host([data-theme="light"]) .sat-banner,
:host(.sat-theme-light) .sat-banner {
  background: var(--sat-bg-solid, #ffffff);
  border-color: var(--sat-border, rgba(0, 0, 0, 0.15));
  box-shadow: var(--sat-shadow, 0 10px 25px -5px rgba(0, 0, 0, 0.15));
}

:host([data-theme="light"]) .sat-banner-title,
:host(.sat-theme-light) .sat-banner-title {
  color: var(--sat-text, #09090b);
}

:host([data-theme="light"]) .sat-banner-desc,
:host(.sat-theme-light) .sat-banner-desc {
  color: var(--sat-text-muted, #71717a);
}

:host([data-theme="light"]) .sat-banner-btn-discard,
:host(.sat-theme-light) .sat-banner-btn-discard {
  background: var(--sat-btn-bg, rgba(0, 0, 0, 0.05));
  border-color: var(--sat-btn-border, rgba(0, 0, 0, 0.1));
  color: var(--sat-text, #27272a);
}

:host([data-theme="light"]) .sat-banner-btn-discard:hover,
:host(.sat-theme-light) .sat-banner-btn-discard:hover {
  background: var(--sat-btn-hover, rgba(0, 0, 0, 0.1));
}
`;
