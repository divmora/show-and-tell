import { DiagnosticEntry, RecordingResult } from '../types';
import { formatBytes, formatDuration } from '../utils/time';
import { MODAL_STYLES } from './styles';
import { DomReplayer } from '../dom/replayer';

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

  constructor(private result: RecordingResult, private uploadEndpoint?: string) {}

  mount(): void {
    if (typeof document === 'undefined') return;

    this.hostElement = document.createElement('show-and-tell-modal');
    this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = MODAL_STYLES;
    this.shadowRoot.appendChild(styleEl);

    const isDom = this.result.mode === 'dom';
    const diagnostics: DiagnosticEntry[] = this.result.diagnostics || [];
    const errorCount = diagnostics.filter(e => e.level === 'error').length;
    const warnCount = diagnostics.filter(e => e.level === 'warn').length;
    const netCount = diagnostics.filter(e => e.source === 'fetch' || e.source === 'xhr').length;
    const hasIssues = errorCount > 0 || warnCount > 0;
    const totalDurationMs = Math.max(1000, this.result.duration * 1000);

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
              </div>
              <input type="text" class="sat-diag-search" id="diagSearchInput" placeholder="Filter logs...">
            </div>
            <div class="sat-diag-list" id="diagList"></div>
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
          <button class="sat-action-btn sat-action-btn-secondary sat-btn-dismiss">
            Close
          </button>
          ${isDom ? `
            <button class="sat-action-btn sat-action-btn-secondary sat-btn-json">
              <svg style="width: 14px; height: 14px; fill: currentColor;" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              Download JSON
            </button>
          ` : ''}
          ${this.uploadEndpoint ? `
            <button class="sat-action-btn sat-action-btn-secondary sat-btn-upload">
              <svg style="width: 15px; height: 15px; fill: currentColor;" viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z"/></svg>
              Upload to Server
            </button>
          ` : ''}
          <button class="sat-action-btn sat-action-btn-primary sat-btn-download">
            <svg style="width: 15px; height: 15px; fill: currentColor;" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
            ${isDom ? 'Download Replay (.html)' : 'Download Video'}
          </button>
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
          item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
        if (currentFilter === 'net' && item.source !== 'fetch' && item.source !== 'xhr') return false;

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
        const badgeText = item.source === 'fetch' || item.source === 'xhr'
          ? `HTTP ${item.status || 'ERR'}`
          : item.level.toUpperCase();

        const contentText = item.source === 'fetch' || item.source === 'xhr'
          ? `${item.method || 'GET'} ${item.url} ${item.durationMs ? `(${item.durationMs}ms)` : ''}`
          : item.message;

        row.innerHTML = `
          <button class="sat-diag-time-btn" title="Seek to ${timeStr}">⏱ ${timeStr}</button>
          <span class="sat-diag-badge ${badgeClass}">${badgeText}</span>
          <span class="sat-diag-content" title="${escapeHtml(contentText)}">${escapeHtml(contentText)}</span>
        `;

        row.addEventListener('click', () => {
          seekTo(itemTime);
          highlightDiagItem(originalIndex);
        });

        diagList.appendChild(row);
      });
    };

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
          this.domReplayer?.togglePlay();
        });

        scrubber?.addEventListener('input', (e) => {
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
          const pct = Math.min(1000, Math.max(0, (cur / dur) * 1000));
          if (videoScrubber && !isScrubbing) {
            videoScrubber.value = String(Math.floor(pct));
          }
          if (videoTimeDisplay) {
            videoTimeDisplay.textContent = `${formatDuration(Math.floor(cur))} / ${formatDuration(Math.floor(dur))}`;
          }
        });

        videoScrubber?.addEventListener('input', () => {
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
        videoEl.play().catch(() => {
          if (videoPlayBtn) videoPlayBtn.textContent = 'Play';
        });
      }
    }

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

    downloadBtn?.addEventListener('click', () => {
      if (isDom && this.result.downloadHtmlReplay) {
        this.result.downloadHtmlReplay();
      } else {
        this.result.download();
      }
    });

    downloadJsonBtn?.addEventListener('click', () => {
      if (this.result.downloadJson) {
        this.result.downloadJson();
      } else {
        this.result.download();
      }
    });

    if (uploadBtn && this.uploadEndpoint) {
      uploadBtn.addEventListener('click', async () => {
        uploadBtn.textContent = 'Uploading...';
        (uploadBtn as HTMLButtonElement).disabled = true;
        try {
          await this.result.upload(this.uploadEndpoint!);
          uploadBtn.textContent = 'Uploaded Successfully!';
        } catch (err: any) {
          uploadBtn.textContent = 'Upload Failed';
          console.error('[ShowAndTell] Upload error:', err);
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

