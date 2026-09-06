export const WIDGET_STYLES = `
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #ffffff;
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
  background: rgba(24, 24, 27, 0.88);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 9999px;
  padding: 8px 14px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
  user-select: none;
  cursor: default;
  transition: border-color 0.2s, box-shadow 0.2s;
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
  color: rgba(255, 255, 255, 0.4);
  padding: 2px 4px;
}

.sat-drag-handle:hover {
  color: rgba(255, 255, 255, 0.8);
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
  background-color: #ef4444;
  animation: sat-dot-pulse 1.5s infinite;
}

.sat-paused .sat-dot {
  background-color: #eab308;
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
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.5px;
  color: #f4f4f5;
}

.sat-warning .sat-timer-text {
  color: #f87171;
}

.sat-timer-sub {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1;
}

.sat-divider {
  width: 1px;
  height: 20px;
  background-color: rgba(255, 255, 255, 0.15);
  margin: 0 2px;
}

.sat-btn-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sat-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #ffffff;
  border-radius: 9999px;
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
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.sat-btn:active {
  transform: translateY(0);
}

.sat-btn-stop {
  background: #dc2626;
  border-color: #ef4444;
  color: white;
}

.sat-btn-stop:hover {
  background: #b91c1c;
}

.sat-btn.sat-btn-active-toggle {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
  color: #f87171;
}

.sat-icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
}
`;

export const MODAL_STYLES = `
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #18181b;
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
  background: #ffffff;
  border-radius: 16px;
  width: 90%;
  max-width: 640px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
  animation: sat-scale-up 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 1;
  transition: width 0.2s cubic-bezier(0.16, 1, 0.3, 1), height 0.2s cubic-bezier(0.16, 1, 0.3, 1), max-width 0.2s, max-height 0.2s;
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
  border-bottom: 1px solid #f4f4f5;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sat-modal-title {
  font-size: 16px;
  font-weight: 600;
  color: #09090b;
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
  color: #71717a;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.sat-maximize-btn:hover {
  background: #f4f4f5;
  color: #18181b;
}

.sat-close-btn {
  background: transparent;
  border: none;
  color: #71717a;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sat-close-btn:hover {
  background: #f4f4f5;
  color: #18181b;
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

.sat-dom-player-wrapper:fullscreen .sat-dom-player-container {
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
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  transition: background 0.15s;
}

.sat-dom-btn:hover {
  background: #1d4ed8;
}

.sat-dom-scrubber {
  flex: 1;
  accent-color: #3b82f6;
  cursor: pointer;
  height: 5px;
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
  background: #f8fafc;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}

.sat-meta-item {
  display: flex;
  flex-direction: column;
}

.sat-meta-label {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  font-weight: 500;
}

.sat-meta-value {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}

.sat-modal-footer {
  padding: 14px 20px;
  border-top: 1px solid #f4f4f5;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  background: #fafafa;
}

.sat-action-btn {
  padding: 8px 16px;
  border-radius: 8px;
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
  background: #ffffff;
  border: 1px solid #e4e4e7;
  color: #27272a;
}

.sat-action-btn-secondary:hover {
  background: #f4f4f5;
}

.sat-action-btn-primary {
  background: #2563eb;
  border: 1px solid #1d4ed8;
  color: #ffffff;
}

.sat-action-btn-primary:hover {
  background: #1d4ed8;
}
`;

export const BANNER_STYLES = `
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 13px;
  line-height: 1.4;
  color: #ffffff;
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
  background: #18181b;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 12px 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
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
  color: #ffffff;
}

.sat-banner-desc {
  font-size: 12px;
  color: #a1a1aa;
}

.sat-banner-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sat-banner-btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  outline: none;
}

.sat-banner-btn-recover {
  background: #2563eb;
  border: 1px solid #3b82f6;
  color: #ffffff;
}

.sat-banner-btn-recover:hover {
  background: #1d4ed8;
}

.sat-banner-btn-discard {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #d4d4d8;
}

.sat-banner-btn-discard:hover {
  background: rgba(255, 255, 255, 0.2);
}
`;
