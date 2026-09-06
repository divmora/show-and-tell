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

.sat-btn.sat-btn-pip {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.35);
  color: #93c5fd;
}

.sat-btn.sat-btn-pip:hover {
  background: #2563eb;
  border-color: #3b82f6;
  color: #ffffff;
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

.sat-scrubber-track-wrap {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.sat-dom-scrubber {
  width: 100%;
  accent-color: #3b82f6;
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
  background-color: #ef4444;
  box-shadow: 0 0 0 1.5px rgba(17, 24, 39, 0.9), 0 0 5px #ef4444;
}

.sat-marker-warn {
  background-color: #f59e0b;
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
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  padding: 4px 8px;
  border-radius: 4px;
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

.sat-video-timeline-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  background: #111827;
  border-radius: 8px;
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
  background: #3b82f6;
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
