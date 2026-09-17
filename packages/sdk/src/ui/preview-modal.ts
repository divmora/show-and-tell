import { 
  DiagnosticEntry, 
  NetworkDiagnosticEntry,
  RecordingResult, 
  UploadConfig, 
  PresignedUploadConfig, 
  ServerUploadConfig,
  ThemeConfig
} from '../types';
import { formatBytes, formatDuration } from '../utils/time';
import { MODAL_STYLES } from './styles';
import { DomReplayer } from '../dom/replayer';
import { applyThemeToHost } from './theme';
import { trimRecordingResult } from '../editor/trimmer';
import { exportToHar } from '../diagnostics/sanitizer';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class PreviewModal {
  private hostElement?: HTMLElement;
  private shadowRoot?: ShadowRoot;
  private domReplayer?: DomReplayer;
  private onFsChange?: () => void;
  private uploadConfig?: string | UploadConfig;
  private inSeconds = 0;
  private outSeconds = 0;
  private isTrimActive = false;

  constructor(
    private result: RecordingResult,
    uploadTarget?: string | UploadConfig,
    private theme?: ThemeConfig
  ) {
    this.uploadConfig = uploadTarget;
  }

  /**
   * Dynamically updates the preview modal's visual theme tokens and color mode.
   */
  public setTheme(theme: ThemeConfig): void {
    this.theme = theme;
    if (this.hostElement) {
      applyThemeToHost(this.hostElement, this.theme);
    }
  }

  private get hasUpload(): boolean {
    return !!this.uploadConfig;
  }

  private get isPresigned(): boolean {
    return !!(this.uploadConfig && typeof this.uploadConfig === 'object' && 'getPresignedUrl' in this.uploadConfig);
  }

  mount(): void {
    if (typeof document === 'undefined') return;

    this.hostElement = document.createElement('show-and-tell-modal');
    applyThemeToHost(this.hostElement, this.theme);
    this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = MODAL_STYLES;
    this.shadowRoot.appendChild(styleEl);

    const isDom = this.result.mode === 'dom';
    const diagnostics: DiagnosticEntry[] = this.result.diagnostics || [];
    const errorCount = diagnostics.filter(e => e.level === 'error').length;
    const warnCount = diagnostics.filter(e => e.level === 'warn').length;
    const netCount = diagnostics.filter(e => e.category === 'network' || e.source === 'fetch' || e.source === 'xhr').length;
    const hasIssues = errorCount > 0 || warnCount > 0;
    const totalDuration = (this.result.duration && Number.isFinite(this.result.duration) && this.result.duration > 0)
      ? this.result.duration
      : 1;
    const totalDurationMs = Math.max(1000, totalDuration * 1000);
    this.inSeconds = 0;
    this.outSeconds = totalDuration;
    this.isTrimActive = false;
    let isPlayingCut = false;

    const dialogWrapper = document.createElement('div');
    dialogWrapper.innerHTML = `
      <div class="sat-modal-backdrop"></div>
      <div class="sat-modal-dialog">
        <div class="sat-modal-header">
          <h3 class="sat-modal-title">
            <svg style="width: 18px; height: 18px; fill: #2563eb;" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
            ${isDom ? 'DOM Session Replay' : 'Recording Ready'}
            <span class="sat-badge-mode">${isDom ? 'DOM Mode' : 'Pixel Video'}</span>
          </h3>
          <div class="sat-modal-header-actions">
            <button class="sat-maximize-btn" id="satMaximizeBtn" title="Maximize">
              <svg id="satMaximizeIcon" style="width: 16px; height: 16px; fill: currentColor;" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
            </button>
            <button class="sat-close-btn" title="Close">
              <svg style="width: 20px; height: 20px; fill: currentColor;" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
          </div>
        </div>
        <div class="sat-modal-body">
          ${isDom ? `
            <div class="sat-dom-player-wrapper">
              <div class="sat-dom-player-container" id="domPlayerSurface"></div>
              <div class="sat-dom-controls">
                <button class="sat-dom-btn" id="domPlayBtn">Play</button>
                <div class="sat-scrubber-track-wrap">
                  <input type="range" class="sat-dom-scrubber" id="domScrubber" min="0" max="1000" value="0">
                  <div class="sat-timeline-markers" id="domMarkers"></div>
                </div>
                <span class="sat-dom-time" id="domTimeDisplay">00:00 / ${formatDuration(this.result.duration)}</span>
                <button class="sat-diagnostics-toggle-btn ${hasIssues ? '' : 'has-no-errors'}" id="domDiagToggleBtn" title="Toggle Diagnostics Drawer">
                  🐞 Diag ${diagnostics.length > 0 ? `(${diagnostics.length})` : ''}
                </button>
                <button class="sat-dom-btn-secondary sat-dom-zoom-btn" id="domZoomBtn" title="Cycle Zoom (Fit / 100% / 150%)">🔍 Fit</button>
                <button class="sat-dom-speed" id="domSpeedBtn">1x</button>
                <button class="sat-dom-btn-secondary sat-dom-fs-btn" id="domFsBtn" title="Toggle Fullscreen">⛶ Fullscreen</button>
                <button class="sat-dom-btn-secondary sat-trim-toggle-btn" id="domTrimBtn" title="Trim Video (Cut unwanted beginnings or endings)">✂️ Trim</button>
              </div>

              <!-- Collapsible DOM Trim Panel -->
              <div class="sat-trim-panel" id="domTrimPanel" style="display: none;">
                <div class="sat-trim-track-wrap">
                  <div class="sat-trim-track" id="domTrimTrack">
                    <div class="sat-trim-cut sat-trim-cut-left" id="domTrimCutLeft" style="width: 0%;"></div>
                    <div class="sat-trim-highlight" id="domTrimHighlight" style="left: 0%; width: 100%;"></div>
                    <div class="sat-trim-cut sat-trim-cut-right" id="domTrimCutRight" style="width: 0%;"></div>
                    <div class="sat-trim-handle sat-trim-handle-in" id="domTrimHandleIn" style="left: 0%;" role="slider" aria-label="Start Trim Handle" tabindex="0">
                      <div class="sat-trim-handle-badge" id="domTrimBadgeIn">00:00</div>
                      <div class="sat-trim-handle-grip"></div>
                    </div>
                    <div class="sat-trim-handle sat-trim-handle-out" id="domTrimHandleOut" style="left: 100%;" role="slider" aria-label="End Trim Handle" tabindex="0">
                      <div class="sat-trim-handle-badge" id="domTrimBadgeOut">${formatDuration(this.result.duration)}</div>
                      <div class="sat-trim-handle-grip"></div>
                    </div>
                  </div>
                </div>
                <div class="sat-trim-footer-bar">
                  <div class="sat-trim-stats">
                    <span class="sat-trim-stat-pill">Original: <strong id="domTrimOrigDur">${formatDuration(this.result.duration)}</strong></span>
                    <span class="sat-trim-stat-pill sat-trim-stat-active">Trimmed: <strong id="domTrimActiveDur">${formatDuration(this.result.duration)}</strong></span>
                    <span class="sat-trim-cut-info" id="domTrimCutInfo">Full Duration (No Cuts)</span>
                  </div>
                  <div class="sat-trim-actions">
                    <button type="button" class="sat-trim-act-btn" id="domTrimPreviewBtn" title="Preview trimmed section">▶ Preview Cut</button>
                    <button type="button" class="sat-trim-act-btn" id="domTrimResetBtn" title="Reset handles">↺ Reset</button>
                  </div>
                </div>
              </div>
            </div>
          ` : `
            <div class="sat-dom-player-wrapper" id="videoPlayerWrapper">
              <div class="sat-video-container" id="videoContainer" style="border-radius: 0; aspect-ratio: 16 / 9; cursor: pointer;">
                <video id="satVideoEl" src="${this.result.url}" playsinline style="width: 100%; height: 100%; object-fit: contain;"></video>
              </div>
              <div class="sat-dom-controls" id="videoControlsBar">
                <button class="sat-dom-btn" id="videoPlayBtn">Play</button>
                <div class="sat-scrubber-track-wrap">
                  <input type="range" class="sat-dom-scrubber" id="videoScrubber" min="0" max="1000" value="0">
                  <div class="sat-timeline-markers" id="videoMarkers"></div>
                </div>
                <span class="sat-dom-time" id="videoTimeDisplay">00:00 / ${formatDuration(this.result.duration)}</span>
                <button class="sat-diagnostics-toggle-btn ${hasIssues ? '' : 'has-no-errors'}" id="videoDiagToggleBtn" title="Toggle Diagnostics Drawer">
                  🐞 Diag ${diagnostics.length > 0 ? `(${diagnostics.length})` : ''}
                </button>
                <button class="sat-dom-speed" id="videoSpeedBtn">1x</button>
                <button class="sat-dom-btn-secondary sat-dom-fs-btn" id="videoFsBtn" title="Toggle Fullscreen">⛶ Fullscreen</button>
                <button class="sat-dom-btn-secondary sat-trim-toggle-btn" id="videoTrimBtn" title="Trim Video (Cut unwanted beginnings or endings)">✂️ Trim</button>
              </div>

              <!-- Collapsible Video Trim Panel -->
              <div class="sat-trim-panel" id="videoTrimPanel" style="display: none;">
                <div class="sat-trim-track-wrap">
                  <div class="sat-trim-track" id="videoTrimTrack">
                    <div class="sat-trim-cut sat-trim-cut-left" id="videoTrimCutLeft" style="width: 0%;"></div>
                    <div class="sat-trim-highlight" id="videoTrimHighlight" style="left: 0%; width: 100%;"></div>
                    <div class="sat-trim-cut sat-trim-cut-right" id="videoTrimCutRight" style="width: 0%;"></div>
                    <div class="sat-trim-handle sat-trim-handle-in" id="videoTrimHandleIn" style="left: 0%;" role="slider" aria-label="Start Trim Handle" tabindex="0">
                      <div class="sat-trim-handle-badge" id="videoTrimBadgeIn">00:00</div>
                      <div class="sat-trim-handle-grip"></div>
                    </div>
                    <div class="sat-trim-handle sat-trim-handle-out" id="videoTrimHandleOut" style="left: 100%;" role="slider" aria-label="End Trim Handle" tabindex="0">
                      <div class="sat-trim-handle-badge" id="videoTrimBadgeOut">${formatDuration(this.result.duration)}</div>
                      <div class="sat-trim-handle-grip"></div>
                    </div>
                  </div>
                </div>
                <div class="sat-trim-footer-bar">
                  <div class="sat-trim-stats">
                    <span class="sat-trim-stat-pill">Original: <strong id="videoTrimOrigDur">${formatDuration(this.result.duration)}</strong></span>
                    <span class="sat-trim-stat-pill sat-trim-stat-active">Trimmed: <strong id="videoTrimActiveDur">${formatDuration(this.result.duration)}</strong></span>
                    <span class="sat-trim-cut-info" id="videoTrimCutInfo">Full Duration (No Cuts)</span>
                  </div>
                  <div class="sat-trim-actions">
                    <button type="button" class="sat-trim-act-btn" id="videoTrimPreviewBtn" title="Preview trimmed section">▶ Preview Cut</button>
                    <button type="button" class="sat-trim-act-btn" id="videoTrimResetBtn" title="Reset handles">↺ Reset</button>
                  </div>
                </div>
              </div>
            </div>
          `}

          <!-- Collapsible Diagnostics Drawer -->
          <div class="sat-diagnostics-drawer sat-collapsed" id="diagDrawer">
            <div class="sat-diag-header">
              <div class="sat-diag-header-title">
                <span>🐞 Diagnostics & Logs</span>
                <span style="font-size: 10px; color: #94a3b8; font-weight: normal;">(${diagnostics.length} events)</span>
              </div>
              <div class="sat-diag-filters">
                <button class="sat-diag-filter-btn active" data-filter="all">All (${diagnostics.length})</button>
                <button class="sat-diag-filter-btn" data-filter="error">Errors (${errorCount})</button>
                <button class="sat-diag-filter-btn" data-filter="warn">Warnings (${warnCount})</button>
                <button class="sat-diag-filter-btn" data-filter="net">Network (${netCount})</button>
                ${netCount > 0 ? `<button class="sat-diag-action-btn" id="diagExportHarBtn" title="Export sanitized HTTP Archive (.har)" style="margin-left: 4px;">📥 Export HAR</button>` : ''}
              </div>
              <input type="text" class="sat-diag-search" id="diagSearchInput" placeholder="Filter logs...">
            </div>
            <div class="sat-diag-list" id="diagList"></div>
            <div class="sat-net-inspector-container" id="netInspectorContainer" style="display: none;"></div>
          </div>

          <div class="sat-meta-grid">
            <div class="sat-meta-item">
              <span class="sat-meta-label">Duration</span>
              <span class="sat-meta-value">${formatDuration(this.result.duration)}</span>
            </div>
            <div class="sat-meta-item">
              <span class="sat-meta-label">File Size</span>
              <span class="sat-meta-value">${formatBytes(this.result.size)}</span>
            </div>
            <div class="sat-meta-item">
              <span class="sat-meta-label">Format</span>
              <span class="sat-meta-value">${isDom ? 'JSON Events' : this.result.mimeType.split(';')[0]}</span>
            </div>
          </div>
        </div>
        <div class="sat-modal-footer">
          <div class="sat-upload-progress-container" style="display: none;">
            <div class="sat-upload-status-text">
              <span class="sat-upload-status-label">Uploading...</span>
              <span class="sat-upload-percent-label">0%</span>
            </div>
            <div class="sat-upload-progress-track">
              <div class="sat-upload-progress-fill"></div>
            </div>
            <div class="sat-upload-feedback"></div>
          </div>
          <div class="sat-modal-footer-actions">
            <button class="sat-action-btn sat-action-btn-secondary sat-btn-dismiss">
              Close
            </button>
            ${isDom ? `
              <button class="sat-action-btn sat-action-btn-secondary sat-btn-json">
                <svg style="width: 14px; height: 14px; fill: currentColor;" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                Download JSON
              </button>
            ` : ''}
            ${this.hasUpload ? `
              <button class="sat-action-btn sat-action-btn-secondary sat-btn-upload">
                <svg class="sat-upload-icon" style="width: 15px; height: 15px; fill: currentColor;" viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
                <span class="sat-upload-btn-label">${this.isPresigned ? 'Upload to Cloud' : 'Upload to Server'}</span>
              </button>
            ` : ''}
            <button class="sat-action-btn sat-action-btn-secondary sat-btn-download-full" id="satDownloadFullBtn" style="display: none;">
              Download Full (${formatDuration(this.result.duration)})
            </button>
            <button class="sat-action-btn sat-action-btn-primary sat-btn-download">
              <svg style="width: 15px; height: 15px; fill: currentColor;" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
              <span id="satDownloadBtnText">${isDom ? 'Download Replay (.html)' : 'Download Video'}</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.shadowRoot.appendChild(dialogWrapper);
    document.body.appendChild(this.hostElement);

    const modalDialog = this.shadowRoot.querySelector('.sat-modal-dialog') as HTMLElement;
    const maximizeBtn = this.shadowRoot.querySelector('#satMaximizeBtn') as HTMLButtonElement;
    const maximizeIcon = this.shadowRoot.querySelector('#satMaximizeIcon') as unknown as SVGElement;
    let isMaximized = false;

    maximizeBtn?.addEventListener('click', () => {
      isMaximized = !isMaximized;
      if (isMaximized) {
        modalDialog?.classList.add('sat-modal-dialog-maximized');
        maximizeBtn.title = 'Restore';
        if (maximizeIcon) {
          maximizeIcon.innerHTML = '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>';
        }
      } else {
        modalDialog?.classList.remove('sat-modal-dialog-maximized');
        maximizeBtn.title = 'Maximize';
        if (maximizeIcon) {
          maximizeIcon.innerHTML = '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>';
        }
      }
      setTimeout(() => {
        this.domReplayer?.updateScaling();
      }, 220);
    });

    const videoEl = this.shadowRoot.querySelector('#satVideoEl') as HTMLVideoElement;
    const diagDrawer = this.shadowRoot.querySelector('#diagDrawer') as HTMLElement;
    const diagList = this.shadowRoot.querySelector('#diagList') as HTMLElement;
    const diagSearchInput = this.shadowRoot.querySelector('#diagSearchInput') as HTMLInputElement;
    const domDiagToggleBtn = this.shadowRoot.querySelector('#domDiagToggleBtn') as HTMLButtonElement;
    const videoDiagToggleBtn = this.shadowRoot.querySelector('#videoDiagToggleBtn') as HTMLButtonElement;
    const diagToggleBtn = domDiagToggleBtn || videoDiagToggleBtn;

    // Unified seek function
    const seekTo = (timestampMs: number) => {
      if (isDom) {
        this.domReplayer?.seek(timestampMs);
      } else if (videoEl) {
        videoEl.currentTime = Math.max(0, timestampMs / 1000);
      }
    };

    // Diagnostics list rendering
    let currentFilter = 'all';
    let currentSearch = '';

    const highlightDiagItem = (idx: number) => {
      const items = diagList?.querySelectorAll('.sat-diag-item');
      items?.forEach(item => {
        if ((item as HTMLElement).dataset.index === String(idx)) {
          item.classList.add('sat-diag-active');
          if (typeof item.scrollIntoView === 'function') {
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        } else {
          item.classList.remove('sat-diag-active');
        }
      });
    };

    const renderDiagList = () => {
      if (!diagList) return;
      diagList.innerHTML = '';

      const filtered = diagnostics.map((item, originalIndex) => ({ item, originalIndex })).filter(({ item }) => {
        if (currentFilter === 'error' && item.level !== 'error') return false;
        if (currentFilter === 'warn' && item.level !== 'warn') return false;
        if (currentFilter === 'net' && item.category !== 'network' && item.source !== 'fetch' && item.source !== 'xhr') return false;

        if (currentSearch) {
          const q = currentSearch.toLowerCase();
          const matchMsg = item.message.toLowerCase().includes(q);
          const matchUrl = item.url?.toLowerCase().includes(q);
          return matchMsg || matchUrl;
        }
        return true;
      });

      if (filtered.length === 0) {
        diagList.innerHTML = `<div class="sat-diag-empty">No diagnostics match the filter criteria.</div>`;
        return;
      }

      filtered.forEach(({ item, originalIndex }) => {
        const row = document.createElement('div');
        row.className = `sat-diag-item sat-diag-item-${item.level}`;
        row.dataset.index = String(originalIndex);
        const itemTime = item.timestampMs ?? item.timestamp;

        const timeStr = formatDuration(Math.floor(itemTime / 1000));
        const badgeClass = `sat-badge-${item.level}`;
        const isNet = item.category === 'network' || item.source === 'fetch' || item.source === 'xhr';
        const method = item.method || 'GET';
        const status = item.status || 0;
        const statusClass = `sat-status-${Math.floor(status / 100)}xx`;
        const durationStr = item.durationMs !== undefined ? `${item.durationMs}ms` : '';

        const contentText = isNet
          ? `${method} ${item.url} ${durationStr ? `(${durationStr})` : ''}`
          : item.message;

        if (isNet) {
          row.innerHTML = `
            <button class="sat-diag-time-btn" title="Seek to ${timeStr}">⏱ ${timeStr}</button>
            <span class="sat-diag-method-badge sat-method-${method.toLowerCase()}">${escapeHtml(method)}</span>
            <span class="sat-net-status-pill ${statusClass}">${status || 'ERR'}</span>
            <span class="sat-diag-content" title="${escapeHtml(item.url || contentText)}">${escapeHtml(item.url || contentText)}</span>
            ${durationStr ? `<span style="font-size: 10px; color: #64748b; flex-shrink: 0;">${durationStr}</span>` : ''}
            <span style="font-size: 10px; color: #3b82f6; flex-shrink: 0; opacity: 0.8;">Inspect ▾</span>
          `;
        } else {
          row.innerHTML = `
            <button class="sat-diag-time-btn" title="Seek to ${timeStr}">⏱ ${timeStr}</button>
            <span class="sat-diag-badge ${badgeClass}">${item.level.toUpperCase()}</span>
            <span class="sat-diag-content" title="${escapeHtml(contentText)}">${escapeHtml(contentText)}</span>
          `;
        }

        row.addEventListener('click', () => {
          seekTo(itemTime);
          highlightDiagItem(originalIndex);
          if (isNet) {
            renderNetworkInspector(item as NetworkDiagnosticEntry);
          } else if (netInspectorContainer) {
            netInspectorContainer.style.display = 'none';
          }
        });

        diagList.appendChild(row);
      });
    };

    const netInspectorContainer = this.shadowRoot.getElementById('netInspectorContainer');
    let activeInspectorTab = 'headers';

    const renderNetworkInspector = (entry: NetworkDiagnosticEntry) => {
      if (!netInspectorContainer) return;
      netInspectorContainer.style.display = 'block';

      const method = entry.method || 'GET';
      const status = entry.status || 0;
      const statusText = entry.statusText || (status >= 400 ? 'Error' : 'OK');
      const statusClass = `sat-status-${Math.floor(status / 100)}xx`;
      const durationStr = entry.durationMs !== undefined ? `${entry.durationMs}ms` : '';

      const renderTabBody = () => {
        if (activeInspectorTab === 'headers') {
          const reqHeaderEntries = Object.entries(entry.requestHeaders || {});
          const resHeaderEntries = Object.entries(entry.responseHeaders || {});

          let html = '<div style="margin-bottom: 6px;"><strong style="color: #94a3b8; font-size: 10px; text-transform: uppercase;">Request Headers</strong></div>';
          if (reqHeaderEntries.length === 0) {
            html += '<div style="color: #64748b; font-style: italic; margin-bottom: 8px;">No request headers recorded</div>';
          } else {
            html += '<table class="sat-net-headers-table">';
            reqHeaderEntries.forEach(([k, v]) => {
              const isRedacted = typeof v === 'string' && (v.includes('[REDACTED]') || v.includes('***'));
              html += `<tr>
                <td class="sat-net-header-key">${escapeHtml(k)}</td>
                <td class="sat-net-header-val">${escapeHtml(String(v))} ${isRedacted ? '<span class="sat-redacted-pill">REDACTED</span>' : ''}</td>
              </tr>`;
            });
            html += '</table>';
          }

          html += '<div style="margin: 10px 0 6px 0;"><strong style="color: #94a3b8; font-size: 10px; text-transform: uppercase;">Response Headers</strong></div>';
          if (resHeaderEntries.length === 0) {
            html += '<div style="color: #64748b; font-style: italic;">No response headers recorded (or restricted by CORS)</div>';
          } else {
            html += '<table class="sat-net-headers-table">';
            resHeaderEntries.forEach(([k, v]) => {
              const isRedacted = typeof v === 'string' && (v.includes('[REDACTED]') || v.includes('***'));
              html += `<tr>
                <td class="sat-net-header-key">${escapeHtml(k)}</td>
                <td class="sat-net-header-val">${escapeHtml(String(v))} ${isRedacted ? '<span class="sat-redacted-pill">REDACTED</span>' : ''}</td>
              </tr>`;
            });
            html += '</table>';
          }
          return html;
        }

        if (activeInspectorTab === 'payload') {
          if (!entry.requestBody) {
            return '<div style="color: #64748b; font-style: italic;">No request payload captured</div>';
          }
          const text = typeof entry.requestBody === 'object' ? JSON.stringify(entry.requestBody, null, 2) : String(entry.requestBody);
          return escapeHtml(text);
        }

        if (activeInspectorTab === 'response') {
          if (!entry.responseBody) {
            return '<div style="color: #64748b; font-style: italic;">No response body captured (success responses omit bodies by default for security & performance)</div>';
          }
          const text = typeof entry.responseBody === 'object' ? JSON.stringify(entry.responseBody, null, 2) : String(entry.responseBody);
          return escapeHtml(text);
        }

        return '';
      };

      netInspectorContainer.innerHTML = `
        <div class="sat-net-inspector-header">
          <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
            <span class="sat-diag-method-badge sat-method-${method.toLowerCase()}">${escapeHtml(method)}</span>
            <span class="sat-net-status-pill ${statusClass}">${status || 'ERR'} ${escapeHtml(statusText)}</span>
            <span style="color: #64748b; font-size: 10px;">${durationStr}</span>
            <span style="color: #94a3b8; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(entry.url || '')}">${escapeHtml(entry.url || '')}</span>
          </div>
          <div style="display: flex; gap: 4px; align-items: center; flex-shrink: 0;">
            <button class="sat-diag-action-btn" id="btnCopyCurl" title="Copy request as cURL">📋 cURL</button>
            <button class="sat-diag-action-btn" id="btnCloseInspector" title="Close Network Details">✕</button>
          </div>
        </div>
        <div class="sat-net-inspector-tabs">
          <button class="sat-net-tab-btn ${activeInspectorTab === 'headers' ? 'active' : ''}" data-tab="headers">Headers</button>
          <button class="sat-net-tab-btn ${activeInspectorTab === 'payload' ? 'active' : ''}" data-tab="payload">Payload</button>
          <button class="sat-net-tab-btn ${activeInspectorTab === 'response' ? 'active' : ''}" data-tab="response">Response</button>
          <span style="margin-left: auto; font-size: 9px; color: #10b981; display: flex; align-items: center; gap: 4px;">
            🔒 Credentials Sanitized
          </span>
        </div>
        <div class="sat-net-tab-content" id="netTabContent">${renderTabBody()}</div>
      `;

      // Wire Tab Buttons
      const tabBtns = netInspectorContainer.querySelectorAll('.sat-net-tab-btn');
      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          tabBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          activeInspectorTab = btn.getAttribute('data-tab') || 'headers';
          const tabContent = netInspectorContainer.querySelector('#netTabContent');
          if (tabContent) tabContent.innerHTML = renderTabBody();
        });
      });

      // Wire Close button
      netInspectorContainer.querySelector('#btnCloseInspector')?.addEventListener('click', () => {
        netInspectorContainer.style.display = 'none';
      });

      // Wire Copy as cURL
      netInspectorContainer.querySelector('#btnCopyCurl')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        let curl = `curl -X ${method} "${entry.url}"`;
        if (entry.requestHeaders) {
          for (const [k, v] of Object.entries(entry.requestHeaders)) {
            curl += ` \\\n  -H "${k}: ${v}"`;
          }
        }
        if (entry.requestBody) {
          const bodyStr = typeof entry.requestBody === 'object' ? JSON.stringify(entry.requestBody) : String(entry.requestBody);
          curl += ` \\\n  -d '${bodyStr.replace(/'/g, "'\\''")}'`;
        }
        try {
          await navigator.clipboard.writeText(curl);
          btn.textContent = '✓ Copied!';
          setTimeout(() => { btn.textContent = '📋 cURL'; }, 2000);
        } catch {
          // fallback
        }
      });
    };

    // Wire Export HAR button
    const diagExportHarBtn = this.shadowRoot.getElementById('diagExportHarBtn');
    diagExportHarBtn?.addEventListener('click', () => {
      const netEntries = diagnostics.filter((e): e is NetworkDiagnosticEntry => e.category === 'network' || e.source === 'fetch' || e.source === 'xhr');
      const harObj = exportToHar(netEntries);
      const harStr = JSON.stringify(harObj, null, 2);
      const blob = new Blob([harStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `network-diagnostics-${Date.now()}.har`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

    renderDiagList();

    // Wire filter buttons
    const filterButtons = this.shadowRoot.querySelectorAll('.sat-diag-filter-btn');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.getAttribute('data-filter') || 'all';
        renderDiagList();
      });
    });

    diagSearchInput?.addEventListener('input', (e) => {
      currentSearch = (e.target as HTMLInputElement).value.trim();
      renderDiagList();
    });

    // Toggle drawer
    const toggleDrawer = () => {
      const isCollapsed = diagDrawer?.classList.toggle('sat-collapsed');
      if (diagToggleBtn) {
        diagToggleBtn.classList.toggle('is-active', !isCollapsed);
      }
    };
    diagToggleBtn?.addEventListener('click', toggleDrawer);

    // Render timeline markers on scrubber/track
    const setupMarkers = (markersEl: HTMLElement | null) => {
      if (!markersEl) return;
      markersEl.innerHTML = '';

      diagnostics.forEach((entry, idx) => {
        const entryTime = entry.timestampMs ?? entry.timestamp;
        const pct = Math.min(100, Math.max(0, (entryTime / totalDurationMs) * 100));
        const marker = document.createElement('div');
        marker.className = `sat-timeline-marker sat-marker-${entry.level}`;
        marker.style.left = `${pct}%`;

        const tooltip = document.createElement('div');
        tooltip.className = 'sat-marker-tooltip';
        const timeStr = formatDuration(Math.floor(entryTime / 1000));
        const label = entry.source === 'fetch' || entry.source === 'xhr'
          ? `[${timeStr}] ${entry.method || 'REQ'} ${entry.status || ''} ${entry.url || ''}`
          : `[${timeStr}] ${entry.message}`;
        tooltip.textContent = label;
        marker.appendChild(tooltip);

        marker.addEventListener('click', (e) => {
          e.stopPropagation();
          seekTo(entryTime);
          diagDrawer?.classList.remove('sat-collapsed');
          diagToggleBtn?.classList.add('is-active');
          highlightDiagItem(idx);
        });

        markersEl.appendChild(marker);
      });
    };

    // Setup DOM Replayer if in DOM mode
    if (isDom) {
      const surface = this.shadowRoot.querySelector('#domPlayerSurface') as HTMLElement;
      const playBtn = this.shadowRoot.querySelector('#domPlayBtn') as HTMLButtonElement;
      const scrubber = this.shadowRoot.querySelector('#domScrubber') as HTMLInputElement;
      const domMarkers = this.shadowRoot.querySelector('#domMarkers') as HTMLElement;
      const timeDisplay = this.shadowRoot.querySelector('#domTimeDisplay') as HTMLElement;
      const speedBtn = this.shadowRoot.querySelector('#domSpeedBtn') as HTMLButtonElement;
      const zoomBtn = this.shadowRoot.querySelector('#domZoomBtn') as HTMLButtonElement;
      const fsBtn = this.shadowRoot.querySelector('#domFsBtn') as HTMLButtonElement;

      setupMarkers(domMarkers);

      if (surface) {
        this.domReplayer = new DomReplayer({
          events: this.result.domEvents || [],
          container: surface,
          cameraUrl: this.result.cameraUrl,
          onTimeUpdate: (curMs, totalMs) => {
            if (isPlayingCut && curMs >= this.outSeconds * 1000) {
              this.domReplayer?.pause();
              this.domReplayer?.seek(this.inSeconds * 1000);
              isPlayingCut = false;
              if (playBtn) playBtn.textContent = 'Play';
              return;
            }
            if (timeDisplay) {
              timeDisplay.textContent = `${formatDuration(Math.floor(curMs / 1000))} / ${formatDuration(Math.floor(totalMs / 1000))}`;
            }
            if (scrubber && totalMs > 0) {
              scrubber.value = String((curMs / totalMs) * 1000);
            }
          },
          onStateChange: (isPlaying) => {
            if (playBtn) playBtn.textContent = isPlaying ? 'Pause' : 'Play';
          },
          onEnded: () => {
            if (playBtn) playBtn.textContent = 'Play';
          },
          onZoomChange: (mode) => {
            if (zoomBtn) {
              zoomBtn.textContent = mode === 'fit' ? '🔍 Fit' : mode === 1 ? '🔍 100%' : mode === 1.5 ? '🔍 150%' : '🔍 200%';
            }
          }
        });

        playBtn?.addEventListener('click', () => {
          isPlayingCut = false;
          this.domReplayer?.togglePlay();
        });

        scrubber?.addEventListener('input', (e) => {
          isPlayingCut = false;
          const val = parseFloat((e.target as HTMLInputElement).value);
          this.domReplayer?.seek((val / 1000) * totalDurationMs);
        });

        let currentSpeed = 1;
        speedBtn?.addEventListener('click', () => {
          currentSpeed = currentSpeed === 1 ? 2 : currentSpeed === 2 ? 0.5 : 1;
          speedBtn.textContent = `${currentSpeed}x`;
          this.domReplayer?.setSpeed(currentSpeed);
        });

        zoomBtn?.addEventListener('click', () => {
          this.domReplayer?.cycleZoom();
        });

        const playerWrapper = this.shadowRoot.querySelector('.sat-dom-player-wrapper') as HTMLElement;
        fsBtn?.addEventListener('click', () => {
          if (document.fullscreenElement) {
            document.exitFullscreen?.().catch(() => {});
          } else if (playerWrapper?.requestFullscreen) {
            playerWrapper.requestFullscreen().catch(() => {});
          }
        });
        this.onFsChange = () => {
          const isFs = !!document.fullscreenElement;
          if (fsBtn) fsBtn.textContent = isFs ? '⛶ Exit' : '⛶ Fullscreen';
          setTimeout(() => {
            this.domReplayer?.updateScaling();
          }, 50);
        };
        document.addEventListener('fullscreenchange', this.onFsChange);
      }
    } else {
      // Pixel Mode Video Controls Sync
      const videoPlayBtn = this.shadowRoot.querySelector('#videoPlayBtn') as HTMLButtonElement;
      const videoScrubber = this.shadowRoot.querySelector('#videoScrubber') as HTMLInputElement;
      const videoMarkers = this.shadowRoot.querySelector('#videoMarkers') as HTMLElement;
      const videoTimeDisplay = this.shadowRoot.querySelector('#videoTimeDisplay') as HTMLElement;
      const videoSpeedBtn = this.shadowRoot.querySelector('#videoSpeedBtn') as HTMLButtonElement;
      const videoFsBtn = this.shadowRoot.querySelector('#videoFsBtn') as HTMLButtonElement;
      const videoPlayerWrapper = this.shadowRoot.querySelector('#videoPlayerWrapper') as HTMLElement;
      const videoContainer = this.shadowRoot.querySelector('#videoContainer') as HTMLElement;

      setupMarkers(videoMarkers);

      const getVideoDuration = () => {
        if (videoEl && Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
          return videoEl.duration;
        }
        return (this.result.duration && Number.isFinite(this.result.duration) && this.result.duration > 0)
          ? this.result.duration
          : 1;
      };

      if (videoEl) {
        let isScrubbing = false;

        const togglePlay = () => {
          isPlayingCut = false;
          if (videoEl.paused || videoEl.ended) {
            videoEl.play().catch(() => {});
          } else {
            videoEl.pause();
          }
        };

        videoPlayBtn?.addEventListener('click', togglePlay);
        videoContainer?.addEventListener('click', (e) => {
          if (e.target === videoEl || e.target === videoContainer) {
            togglePlay();
          }
        });

        videoEl.addEventListener('play', () => {
          if (videoPlayBtn) videoPlayBtn.textContent = 'Pause';
        });

        videoEl.addEventListener('pause', () => {
          if (videoPlayBtn) videoPlayBtn.textContent = 'Play';
        });

        videoEl.addEventListener('ended', () => {
          if (videoPlayBtn) videoPlayBtn.textContent = 'Play';
        });

        videoEl.addEventListener('timeupdate', () => {
          const dur = getVideoDuration();
          const cur = videoEl.currentTime || 0;

          if (isPlayingCut && cur >= this.outSeconds) {
            videoEl.pause();
            videoEl.currentTime = this.inSeconds;
            isPlayingCut = false;
            if (videoPlayBtn) videoPlayBtn.textContent = 'Play';
            return;
          }

          const pct = Math.min(1000, Math.max(0, (cur / dur) * 1000));
          if (videoScrubber && !isScrubbing) {
            videoScrubber.value = String(Math.floor(pct));
          }
          if (videoTimeDisplay) {
            videoTimeDisplay.textContent = `${formatDuration(Math.floor(cur))} / ${formatDuration(Math.floor(dur))}`;
          }
        });

        videoScrubber?.addEventListener('input', () => {
          isPlayingCut = false;
          isScrubbing = true;
          const dur = getVideoDuration();
          const targetTime = (Number(videoScrubber.value) / 1000) * dur;
          videoEl.currentTime = targetTime;
          if (videoTimeDisplay) {
            videoTimeDisplay.textContent = `${formatDuration(Math.floor(targetTime))} / ${formatDuration(Math.floor(dur))}`;
          }
        });

        videoScrubber?.addEventListener('change', () => {
          isScrubbing = false;
        });

        let speedIdx = 0;
        const speeds = [1, 1.5, 2, 0.5];
        videoSpeedBtn?.addEventListener('click', () => {
          speedIdx = (speedIdx + 1) % speeds.length;
          const speed = speeds[speedIdx];
          videoEl.playbackRate = speed;
          videoSpeedBtn.textContent = `${speed}x`;
        });

        videoFsBtn?.addEventListener('click', () => {
          if (document.fullscreenElement) {
            document.exitFullscreen?.().catch(() => {});
          } else if (videoPlayerWrapper?.requestFullscreen) {
            videoPlayerWrapper.requestFullscreen().catch(() => {});
          }
        });

        this.onFsChange = () => {
          const isFs = !!document.fullscreenElement;
          if (videoFsBtn) videoFsBtn.textContent = isFs ? '⛶ Exit' : '⛶ Fullscreen';
        };
        document.addEventListener('fullscreenchange', this.onFsChange);

        // Attempt autoplay
        videoEl.play()?.catch(() => {
          if (videoPlayBtn) videoPlayBtn.textContent = 'Play';
        });
      }
    }

    // Wire trimmer controls
    const prefix = isDom ? 'dom' : 'video';
    const trimBtn = this.shadowRoot.querySelector(`#${prefix}TrimBtn`) as HTMLButtonElement | null;
    const trimPanel = this.shadowRoot.querySelector(`#${prefix}TrimPanel`) as HTMLElement | null;
    const trimTrack = this.shadowRoot.querySelector(`#${prefix}TrimTrack`) as HTMLElement | null;
    const cutLeft = this.shadowRoot.querySelector(`#${prefix}TrimCutLeft`) as HTMLElement | null;
    const highlight = this.shadowRoot.querySelector(`#${prefix}TrimHighlight`) as HTMLElement | null;
    const cutRight = this.shadowRoot.querySelector(`#${prefix}TrimCutRight`) as HTMLElement | null;
    const handleIn = this.shadowRoot.querySelector(`#${prefix}TrimHandleIn`) as HTMLElement | null;
    const handleOut = this.shadowRoot.querySelector(`#${prefix}TrimHandleOut`) as HTMLElement | null;
    const badgeIn = this.shadowRoot.querySelector(`#${prefix}TrimBadgeIn`) as HTMLElement | null;
    const badgeOut = this.shadowRoot.querySelector(`#${prefix}TrimBadgeOut`) as HTMLElement | null;
    const activeDurEl = this.shadowRoot.querySelector(`#${prefix}TrimActiveDur`) as HTMLElement | null;
    const cutInfoEl = this.shadowRoot.querySelector(`#${prefix}TrimCutInfo`) as HTMLElement | null;
    const previewBtn = this.shadowRoot.querySelector(`#${prefix}TrimPreviewBtn`) as HTMLButtonElement | null;
    const resetBtn = this.shadowRoot.querySelector(`#${prefix}TrimResetBtn`) as HTMLButtonElement | null;
    const downloadFullBtn = this.shadowRoot.querySelector('#satDownloadFullBtn') as HTMLButtonElement | null;
    const downloadBtnText = this.shadowRoot.querySelector('#satDownloadBtnText') as HTMLElement | null;

    const isTrimmed = () => {
      return this.inSeconds > 0.05 || this.outSeconds < (totalDuration - 0.05);
    };

    const updateTrimUi = () => {
      const inPct = Math.max(0, Math.min(100, (this.inSeconds / totalDuration) * 100));
      const outPct = Math.max(0, Math.min(100, (this.outSeconds / totalDuration) * 100));

      if (cutLeft) cutLeft.style.width = `${inPct}%`;
      if (highlight) {
        highlight.style.left = `${inPct}%`;
        highlight.style.width = `${Math.max(0, outPct - inPct)}%`;
      }
      if (cutRight) cutRight.style.width = `${Math.max(0, 100 - outPct)}%`;

      if (handleIn) {
        handleIn.style.left = `${inPct}%`;
        handleIn.setAttribute('aria-valuenow', String(Math.round(this.inSeconds)));
      }
      if (handleOut) {
        handleOut.style.left = `${outPct}%`;
        handleOut.setAttribute('aria-valuenow', String(Math.round(this.outSeconds)));
      }

      if (badgeIn) badgeIn.textContent = formatDuration(Math.round(this.inSeconds));
      if (badgeOut) badgeOut.textContent = formatDuration(Math.round(this.outSeconds));

      const trimmedDur = Math.max(0, this.outSeconds - this.inSeconds);
      if (activeDurEl) activeDurEl.textContent = formatDuration(Math.round(trimmedDur));

      const cutTotal = totalDuration - trimmedDur;
      const trimmed = isTrimmed();

      if (cutInfoEl) {
        if (trimmed) {
          cutInfoEl.textContent = `✂️ ${formatDuration(Math.round(cutTotal))} removed`;
        } else {
          cutInfoEl.textContent = 'Full Duration (No Cuts)';
        }
      }

      if (downloadFullBtn) {
        downloadFullBtn.style.display = trimmed ? 'inline-flex' : 'none';
      }
      if (downloadBtnText) {
        if (trimmed) {
          downloadBtnText.textContent = isDom
            ? `Download Trimmed Replay (${formatDuration(Math.round(trimmedDur))})`
            : `Download Trimmed Video (${formatDuration(Math.round(trimmedDur))})`;
        } else {
          downloadBtnText.textContent = isDom ? 'Download Replay (.html)' : 'Download Video';
        }
      }
    };

    trimBtn?.addEventListener('click', () => {
      this.isTrimActive = !this.isTrimActive;
      if (trimPanel) {
        trimPanel.style.display = this.isTrimActive ? 'block' : 'none';
      }
      trimBtn.classList.toggle('is-active', this.isTrimActive);
      trimBtn.textContent = this.isTrimActive ? '✕ Close Trimmer' : '✂️ Trim';
    });

    const makeDraggable = (handle: HTMLElement, isInHandle: boolean) => {
      let isDragging = false;

      const onPointerMove = (clientX: number) => {
        if (!isDragging || !trimTrack) return;
        const rect = trimTrack.getBoundingClientRect();
        const trackWidth = rect.width || 1;
        const offsetX = Math.max(0, Math.min(trackWidth, clientX - rect.left));
        const targetSec = (offsetX / trackWidth) * totalDuration;

        if (isInHandle) {
          this.inSeconds = Math.max(0, Math.min(targetSec, this.outSeconds - 0.2));
          updateTrimUi();
          seekTo(this.inSeconds * 1000);
        } else {
          this.outSeconds = Math.min(totalDuration, Math.max(targetSec, this.inSeconds + 0.2));
          updateTrimUi();
          seekTo(this.outSeconds * 1000);
        }
      };

      const onPointerUp = () => {
        if (isDragging) {
          isDragging = false;
          handle.classList.remove('sat-trim-dragging');
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onPointerUp);
          window.removeEventListener('touchmove', onTouchMove);
          window.removeEventListener('touchend', onPointerUp);
        }
      };

      const onMouseMove = (e: MouseEvent) => {
        onPointerMove(e.clientX);
      };

      const onTouchMove = (e: TouchEvent) => {
        if (e.touches && e.touches[0]) {
          onPointerMove(e.touches[0].clientX);
        }
      };

      handle.addEventListener('mousedown', (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        handle.classList.add('sat-trim-dragging');
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onPointerUp);
      });

      handle.addEventListener('touchstart', (e: TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        isDragging = true;
        handle.classList.add('sat-trim-dragging');
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onPointerUp);
      });

      handle.addEventListener('keydown', (e: KeyboardEvent) => {
        const step = e.shiftKey ? 5 : 1;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (isInHandle) {
            this.inSeconds = Math.max(0, this.inSeconds - step);
            seekTo(this.inSeconds * 1000);
          } else {
            this.outSeconds = Math.max(this.inSeconds + 0.2, this.outSeconds - step);
            seekTo(this.outSeconds * 1000);
          }
          updateTrimUi();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (isInHandle) {
            this.inSeconds = Math.min(this.outSeconds - 0.2, this.inSeconds + step);
            seekTo(this.inSeconds * 1000);
          } else {
            this.outSeconds = Math.min(totalDuration, this.outSeconds + step);
            seekTo(this.outSeconds * 1000);
          }
          updateTrimUi();
        }
      });
    };

    if (handleIn) makeDraggable(handleIn, true);
    if (handleOut) makeDraggable(handleOut, false);

    trimTrack?.addEventListener('click', (e: MouseEvent) => {
      if (e.target === handleIn || handleIn?.contains(e.target as Node)) return;
      if (e.target === handleOut || handleOut?.contains(e.target as Node)) return;
      const rect = trimTrack.getBoundingClientRect();
      const trackWidth = rect.width || 1;
      const offsetX = Math.max(0, Math.min(trackWidth, e.clientX - rect.left));
      const targetSec = (offsetX / trackWidth) * totalDuration;

      const distIn = Math.abs(targetSec - this.inSeconds);
      const distOut = Math.abs(targetSec - this.outSeconds);

      if (distIn <= distOut) {
        this.inSeconds = Math.max(0, Math.min(targetSec, this.outSeconds - 0.2));
        seekTo(this.inSeconds * 1000);
      } else {
        this.outSeconds = Math.min(totalDuration, Math.max(targetSec, this.inSeconds + 0.2));
        seekTo(this.outSeconds * 1000);
      }
      updateTrimUi();
    });

    previewBtn?.addEventListener('click', () => {
      isPlayingCut = true;
      seekTo(this.inSeconds * 1000);
      if (isDom) {
        this.domReplayer?.play();
      } else if (videoEl) {
        videoEl.currentTime = this.inSeconds;
        videoEl.play().catch(() => {});
      }
    });

    resetBtn?.addEventListener('click', () => {
      this.inSeconds = 0;
      this.outSeconds = totalDuration;
      isPlayingCut = false;
      updateTrimUi();
      seekTo(0);
    });

    updateTrimUi();

    const getPreparedResult = async (onProgress?: (progress: number) => void): Promise<RecordingResult> => {
      if (!isTrimmed()) {
        return this.result;
      }
      return trimRecordingResult(
        this.result,
        { inSeconds: this.inSeconds, outSeconds: this.outSeconds },
        onProgress
      );
    };

    const closeBtn = this.shadowRoot.querySelector('.sat-close-btn');
    const dismissBtn = this.shadowRoot.querySelector('.sat-btn-dismiss');
    const backdrop = this.shadowRoot.querySelector('.sat-modal-backdrop');
    const downloadBtn = this.shadowRoot.querySelector('.sat-btn-download');
    const downloadJsonBtn = this.shadowRoot.querySelector('.sat-btn-json');
    const uploadBtn = this.shadowRoot.querySelector('.sat-btn-upload');

    const handleClose = () => this.destroy();
    closeBtn?.addEventListener('click', handleClose);
    dismissBtn?.addEventListener('click', handleClose);
    backdrop?.addEventListener('click', handleClose);

    downloadBtn?.addEventListener('click', async () => {
      if (isTrimmed()) {
        const origText = downloadBtnText?.textContent || '';
        if (downloadBtnText) downloadBtnText.textContent = 'Trimming & Preparing...';
        (downloadBtn as HTMLButtonElement).disabled = true;
        try {
          const trimmed = await getPreparedResult();
          if (isDom && trimmed.downloadHtmlReplay) {
            trimmed.downloadHtmlReplay();
          } else {
            trimmed.download();
          }
        } catch (err) {
          console.error('[ShowAndTell] Failed to trim recording for download:', err);
          if (isDom && this.result.downloadHtmlReplay) {
            this.result.downloadHtmlReplay();
          } else {
            this.result.download();
          }
        } finally {
          (downloadBtn as HTMLButtonElement).disabled = false;
          if (downloadBtnText) downloadBtnText.textContent = origText;
        }
      } else {
        if (isDom && this.result.downloadHtmlReplay) {
          this.result.downloadHtmlReplay();
        } else {
          this.result.download();
        }
      }
    });

    downloadJsonBtn?.addEventListener('click', async () => {
      if (isTrimmed()) {
        (downloadJsonBtn as HTMLButtonElement).disabled = true;
        try {
          const trimmed = await getPreparedResult();
          if (trimmed.downloadJson) {
            trimmed.downloadJson();
          } else {
            trimmed.download();
          }
        } catch (err) {
          console.error('[ShowAndTell] Failed to trim JSON recording:', err);
          if (this.result.downloadJson) {
            this.result.downloadJson();
          } else {
            this.result.download();
          }
        } finally {
          (downloadJsonBtn as HTMLButtonElement).disabled = false;
        }
      } else {
        if (this.result.downloadJson) {
          this.result.downloadJson();
        } else {
          this.result.download();
        }
      }
    });

    downloadFullBtn?.addEventListener('click', () => {
      if (isDom && this.result.downloadHtmlReplay) {
        this.result.downloadHtmlReplay();
      } else {
        this.result.download();
      }
    });

    if (uploadBtn && this.hasUpload) {
      const uploadContainer = this.shadowRoot.querySelector('.sat-upload-progress-container') as HTMLElement | null;
      const statusLabel = this.shadowRoot.querySelector('.sat-upload-status-label') as HTMLElement | null;
      const percentLabel = this.shadowRoot.querySelector('.sat-upload-percent-label') as HTMLElement | null;
      const progressFill = this.shadowRoot.querySelector('.sat-upload-progress-fill') as HTMLElement | null;
      const feedbackEl = this.shadowRoot.querySelector('.sat-upload-feedback') as HTMLElement | null;
      const btnLabel = uploadBtn.querySelector('.sat-upload-btn-label') as HTMLElement | null;

      uploadBtn.addEventListener('click', async () => {
        (uploadBtn as HTMLButtonElement).disabled = true;
        if (feedbackEl) feedbackEl.innerHTML = '';

        let targetResult = this.result;
        if (isTrimmed()) {
          if (btnLabel) btnLabel.textContent = 'Trimming video...';
          try {
            targetResult = await getPreparedResult();
          } catch (err) {
            console.warn('[ShowAndTell] Trimming before upload failed, uploading original:', err);
          }
        }

        if (this.isPresigned) {
          const presignedConfig = this.uploadConfig as PresignedUploadConfig;
          if (uploadContainer) uploadContainer.style.display = 'flex';
          if (statusLabel) statusLabel.textContent = 'Uploading recording to cloud...';
          if (percentLabel) percentLabel.textContent = '0%';
          if (progressFill) {
            progressFill.style.width = '0%';
            progressFill.classList.remove('is-complete');
          }
          if (btnLabel) btnLabel.textContent = 'Uploading...';

          try {
            const uploadResult = await targetResult.uploadPresigned({
              ...presignedConfig,
              onProgress: (progress) => {
                if (progressFill) progressFill.style.width = `${progress.percent}%`;
                if (percentLabel) percentLabel.textContent = `${progress.percent}%`;
                if (statusLabel) {
                  statusLabel.textContent = progress.fileType === 'camera'
                    ? `Uploading camera bubble (${progress.percent}%)...`
                    : `Uploading recording (${progress.percent}%)...`;
                }
                if (btnLabel) btnLabel.textContent = `Uploading ${progress.percent}%...`;
                presignedConfig.onProgress?.(progress);
              }
            });

            if (progressFill) {
              progressFill.style.width = '100%';
              progressFill.classList.add('is-complete');
            }
            if (percentLabel) percentLabel.textContent = '100%';
            if (statusLabel) statusLabel.textContent = 'Upload complete!';
            if (btnLabel) btnLabel.textContent = 'Uploaded Successfully!';

            if (uploadResult.publicUrl && feedbackEl) {
              feedbackEl.innerHTML = `
                <a href="${uploadResult.publicUrl}" target="_blank" rel="noopener" class="sat-upload-success-link">
                  Open Link ↗
                </a>
                <button class="sat-upload-copy-btn" type="button" title="Copy public link">Copy Link</button>
              `;
              const copyBtn = feedbackEl.querySelector('.sat-upload-copy-btn');
              copyBtn?.addEventListener('click', async () => {
                try {
                  await navigator.clipboard.writeText(uploadResult.publicUrl!);
                  (copyBtn as HTMLButtonElement).textContent = 'Copied!';
                  setTimeout(() => {
                    (copyBtn as HTMLButtonElement).textContent = 'Copy Link';
                  }, 2000);
                } catch {
                  window.open(uploadResult.publicUrl, '_blank');
                }
              });
            }
          } catch (err: any) {
            (uploadBtn as HTMLButtonElement).disabled = false;
            if (btnLabel) btnLabel.textContent = 'Retry Upload';
            if (feedbackEl) {
              feedbackEl.innerHTML = `<span class="sat-upload-error-msg">${escapeHtml(err.message || 'Upload failed')}</span>`;
            }
            console.error('[ShowAndTell] Presigned upload error:', err);
          }
        } else {
          // Server upload
          const endpoint = typeof this.uploadConfig === 'string'
            ? this.uploadConfig
            : (this.uploadConfig as ServerUploadConfig).endpoint;
          const options = typeof this.uploadConfig === 'object'
            ? (this.uploadConfig as ServerUploadConfig).options
            : undefined;

          if (btnLabel) btnLabel.textContent = 'Uploading...';
          try {
            const res = await targetResult.upload(endpoint, options);
            if (btnLabel) btnLabel.textContent = 'Uploaded Successfully!';
            if (typeof this.uploadConfig === 'object' && (this.uploadConfig as ServerUploadConfig).onSuccess) {
              (this.uploadConfig as ServerUploadConfig).onSuccess!(res);
            }
          } catch (err: any) {
            (uploadBtn as HTMLButtonElement).disabled = false;
            if (btnLabel) btnLabel.textContent = 'Upload Failed (Retry)';
            console.error('[ShowAndTell] Server upload error:', err);
            if (typeof this.uploadConfig === 'object' && (this.uploadConfig as ServerUploadConfig).onError) {
              (this.uploadConfig as ServerUploadConfig).onError!(err);
            }
          }
        }
      });
    }
  }

  destroy(): void {
    if (this.onFsChange) {
      document.removeEventListener('fullscreenchange', this.onFsChange);
      this.onFsChange = undefined;
    }
    if (this.domReplayer) {
      this.domReplayer.destroy();
      this.domReplayer = undefined;
    }
    if (this.hostElement && this.hostElement.parentNode) {
      this.hostElement.parentNode.removeChild(this.hostElement);
    }
  }
}

