import { DiagnosticEntry, DomRecordingEvent } from '../types';

export interface StandalonePlayerOptions {
  events: DomRecordingEvent[];
  durationSeconds: number;
  sessionId: string;
  title?: string;
  diagnostics?: DiagnosticEntry[];
  cameraDataUri?: string;
}

export function generateStandalonePlayerHtml(options: StandalonePlayerOptions): string {
  const jsonEvents = JSON.stringify(options.events).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  const jsonDiagnostics = JSON.stringify(options.diagnostics || []).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  const title = options.title || `ShowAndTell DOM Session Replay - ${options.sessionId}`;
  const durationSec = Math.max(1, options.durationSeconds);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0b0f19;
      color: #f0f6fc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background-color: #111827;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 10;
      flex-shrink: 0;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      font-size: 15px;
    }
    .badge {
      font-size: 11px;
      font-weight: 600;
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.3);
      padding: 2px 8px;
      border-radius: 9999px;
    }
    .viewport-container {
      flex: 1;
      min-height: 0;
      position: relative;
      background-color: #0b0f19;
      overflow: hidden;
      display: flex;
      padding: 24px;
      box-sizing: border-box;
    }
    .viewport-container::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    .viewport-container::-webkit-scrollbar-track {
      background: #0b0f19;
    }
    .viewport-container::-webkit-scrollbar-thumb {
      background: #334155;
      border-radius: 4px;
    }
    .viewport-container::-webkit-scrollbar-thumb:hover {
      background: #475569;
    }
    .viewport-spacer {
      position: relative;
      flex-shrink: 0;
      margin: auto;
      border-radius: 8px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6);
    }
    .viewport-wrapper {
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: top left;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
    }
    iframe {
      border: none;
      display: block;
      background-color: #ffffff;
    }
    .virtual-cursor {
      position: absolute;
      width: 16px;
      height: 16px;
      pointer-events: none;
      z-index: 999999;
      transform: translate(-2px, -2px);
      transition: transform 0.04s linear;
      display: none;
    }
    .player-controls {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 20px;
      background-color: #111827;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 10;
      flex-shrink: 0;
    }
    button.ctrl-btn {
      background: #2563eb;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
    }
    button.ctrl-btn:hover { background: #1d4ed8; }
    .speed-btn {
      background: rgba(255, 255, 255, 0.08);
      color: #cbd5e1;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .speed-btn:hover { background: rgba(255, 255, 255, 0.16); }
    .speed-btn.has-issues {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.35);
      color: #f87171;
    }
    .speed-btn.is-active {
      background: #ef4444;
      color: #ffffff;
      border-color: #ef4444;
    }
    .scrubber-container {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .scrubber-track-wrap {
      position: relative;
      flex: 1;
      display: flex;
      align-items: center;
    }
    input[type="range"] {
      width: 100%;
      accent-color: #3b82f6;
      cursor: pointer;
      height: 6px;
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
      width: 8px;
      height: 8px;
      border-radius: 50%;
      cursor: pointer;
      pointer-events: auto;
      transition: transform 0.15s ease;
    }
    .sat-timeline-marker:hover {
      transform: translate(-50%, -50%) scale(1.8);
      z-index: 10;
    }
    .sat-marker-error {
      background-color: #ef4444;
      box-shadow: 0 0 0 1.5px rgba(17, 24, 39, 0.9), 0 0 6px #ef4444;
    }
    .sat-marker-warn {
      background-color: #f59e0b;
      box-shadow: 0 0 0 1.5px rgba(17, 24, 39, 0.9), 0 0 6px #f59e0b;
    }
    .sat-marker-info {
      background-color: #38bdf8;
      box-shadow: 0 0 0 1.5px rgba(17, 24, 39, 0.9), 0 0 6px #38bdf8;
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
    .sat-diagnostics-drawer {
      background: #0f172a;
      border-top: 1px solid #1e293b;
      max-height: 220px;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    .sat-diag-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      background: #1e293b;
      border-bottom: 1px solid #334155;
      font-size: 12px;
      color: #f1f5f9;
      gap: 10px;
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
      padding: 3px 8px;
      border-radius: 4px;
      outline: none;
      width: 140px;
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
      gap: 10px;
      padding: 5px 16px;
      font-size: 11px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #cbd5e1;
      cursor: pointer;
      border-left: 3px solid transparent;
    }
    .sat-diag-item:hover {
      background: rgba(255, 255, 255, 0.06);
    }
    .sat-diag-item.sat-diag-active {
      background: rgba(59, 130, 246, 0.15);
    }
    .sat-diag-item-error { border-left-color: #ef4444; }
    .sat-diag-item-warn { border-left-color: #f59e0b; }
    .sat-diag-item-info { border-left-color: #38bdf8; }
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
    .time-display {
      font-size: 13px;
      font-variant-numeric: tabular-nums;
      color: #94a3b8;
      min-width: 80px;
    }
    .view-badge {
      font-size: 11px;
      color: #64748b;
      margin-left: 8px;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span>🎬 ShowAndTell</span>
      <span class="badge">DOM Replay</span>
      <span style="font-size: 11px; color: #94a3b8; font-weight: 400;">Session: ${options.sessionId}</span>
      <span class="view-badge" id="viewBadge"></span>
    </div>
  </header>

  <div class="viewport-container" id="viewport">
    <div class="viewport-spacer" id="viewportSpacer">
      <div class="viewport-wrapper" id="viewportWrapper">
        <iframe id="replayFrame" sandbox="allow-same-origin"></iframe>
        <div class="virtual-cursor" id="virtualCursor">
          <svg viewBox="0 0 24 24" width="20" height="20" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));">
            <path d="M4 2l16 10-6.5 1.5 4.5 7.5-2.5 1.5-4.5-7.5L7 18z" fill="#ef4444" stroke="#ffffff" stroke-width="1.5"/>
          </svg>
        </div>
      </div>
    </div>
  </div>

  <div class="sat-diagnostics-drawer" id="diagDrawer" style="display: none;">
    <div class="sat-diag-header">
      <div style="display: flex; align-items: center; gap: 8px; font-weight: 600;">
        <span>🐞 Diagnostics & Logs</span>
        <span id="diagCountPill" style="font-size: 10px; color: #94a3b8; font-weight: 400;"></span>
      </div>
      <div class="sat-diag-filters">
        <button class="sat-diag-filter-btn active" data-filter="all">All</button>
        <button class="sat-diag-filter-btn" data-filter="error">Errors</button>
        <button class="sat-diag-filter-btn" data-filter="warn">Warnings</button>
        <button class="sat-diag-filter-btn" data-filter="net">Network</button>
      </div>
      <input type="text" class="sat-diag-search" id="diagSearchInput" placeholder="Filter logs...">
    </div>
    <div class="sat-diag-list" id="diagList"></div>
  </div>

  <div class="player-controls">
    <button class="ctrl-btn" id="playBtn">Play</button>
    <div class="scrubber-container">
      <span class="time-display" id="timeCurrent">00:00</span>
      <div class="scrubber-track-wrap">
        <input type="range" id="progressBar" min="0" max="1000" value="0">
        <div class="sat-timeline-markers" id="timelineMarkers"></div>
      </div>
      <span class="time-display" id="timeTotal">00:00</span>
    </div>
    <button class="speed-btn" id="diagBtn" title="Toggle Diagnostics Drawer">🐞 Diag</button>
    <button class="speed-btn" id="zoomBtn" title="Cycle Zoom Mode (Fit / 100% / 150%)">🔍 Fit</button>
    <button class="speed-btn" id="speedBtn">1x Speed</button>
    <button class="speed-btn" id="fsBtn" title="Fullscreen">⛶ Fullscreen</button>
  </div>

  <script>
    const events = ${jsonEvents};
    const totalDurationMs = Math.max(1000, events.length > 0 ? events[events.length - 1].timestamp : ${durationSec * 1000});

    const viewport = document.getElementById('viewport');
    const viewportSpacer = document.getElementById('viewportSpacer');
    const viewportWrapper = document.getElementById('viewportWrapper');
    const iframe = document.getElementById('replayFrame');
    const cursor = document.getElementById('virtualCursor');
    const playBtn = document.getElementById('playBtn');
    const progressBar = document.getElementById('progressBar');
    const timeCurrent = document.getElementById('timeCurrent');
    const timeTotal = document.getElementById('timeTotal');
    const zoomBtn = document.getElementById('zoomBtn');
    const speedBtn = document.getElementById('speedBtn');
    const fsBtn = document.getElementById('fsBtn');
    const viewBadge = document.getElementById('viewBadge');

    let zoomMode = 'fit';
    let currentScale = 1;
    let fitScale = 1;

    // Extract exact recorded browser view dimensions & scroll offset
    const snap = events.find(e => e.type === 'dom_snapshot');
    let viewW = (snap && snap.viewport && snap.viewport.width) || 1280;
    let viewH = (snap && snap.viewport && snap.viewport.height) || 800;
    let initialScrollX = (snap && snap.viewport && snap.viewport.scrollX) || 0;
    let initialScrollY = (snap && snap.viewport && snap.viewport.scrollY) || 0;

    viewBadge.textContent = 'View: ' + viewW + ' × ' + viewH;

    viewportWrapper.style.width = viewW + 'px';
    viewportWrapper.style.height = viewH + 'px';
    iframe.style.width = viewW + 'px';
    iframe.style.height = viewH + 'px';

    const cameraDataUri = ${JSON.stringify(options.cameraDataUri || null)};
    let cameraWrapper = null;
    let cameraVideo = null;

    if (cameraDataUri) {
      cameraWrapper = document.createElement('div');
      cameraWrapper.className = 'sat-replay-camera-wrapper';
      cameraWrapper.style.position = 'absolute';
      cameraWrapper.style.zIndex = '999990';
      cameraWrapper.style.overflow = 'hidden';
      cameraWrapper.style.backgroundColor = '#111827';
      cameraWrapper.style.border = '2px solid rgba(255, 255, 255, 0.25)';
      cameraWrapper.style.filter = 'drop-shadow(0 10px 25px rgba(0,0,0,0.5))';
      cameraWrapper.style.transition = 'width 0.2s ease, height 0.2s ease, border-radius 0.2s ease';
      cameraWrapper.style.pointerEvents = 'none';

      const firstCam = events.find(e => e.type === 'camera_position');
      const initialW = (firstCam && firstCam.width) || 160;
      const initialH = (firstCam && firstCam.height) || 160;
      const initialX = (firstCam && firstCam.x !== undefined) ? firstCam.x : 24;
      const initialY = (firstCam && firstCam.y !== undefined) ? firstCam.y : Math.max(10, viewH - initialH - 24);
      const isRect = firstCam && firstCam.shape === 'rect';

      cameraWrapper.style.width = initialW + 'px';
      cameraWrapper.style.height = initialH + 'px';
      cameraWrapper.style.left = initialX + 'px';
      cameraWrapper.style.top = initialY + 'px';
      cameraWrapper.style.borderRadius = isRect ? '12px' : '50%';

      cameraVideo = document.createElement('video');
      cameraVideo.className = 'sat-replay-camera-video';
      cameraVideo.src = cameraDataUri;
      cameraVideo.playsInline = true;
      cameraVideo.muted = true;
      cameraVideo.autoplay = false;
      cameraVideo.style.width = '100%';
      cameraVideo.style.height = '100%';
      cameraVideo.style.objectFit = 'cover';
      cameraVideo.style.transform = 'scaleX(-1)';
      cameraVideo.style.pointerEvents = 'none';

      cameraWrapper.appendChild(cameraVideo);
      viewportWrapper.appendChild(cameraWrapper);
    }

    function updateScaling() {
      const padX = 48;
      const padY = 48;
      const availW = Math.max(100, viewport.clientWidth - padX);
      const availH = Math.max(100, viewport.clientHeight - padY);
      if (!availW || !availH) return;

      fitScale = Math.min(availW / viewW, availH / viewH);
      let scale = fitScale;
      if (zoomMode === 1) scale = 1.0;
      else if (zoomMode === 1.5) scale = 1.5;
      else if (zoomMode === 2) scale = 2.0;

      currentScale = scale;
      const scaledW = Math.round(viewW * scale);
      const scaledH = Math.round(viewH * scale);

      viewportSpacer.style.width = scaledW + 'px';
      viewportSpacer.style.height = scaledH + 'px';
      viewportWrapper.style.transform = 'scale(' + scale + ')';

      if (scale > fitScale * 1.02) {
        viewport.style.overflow = 'auto';
        viewport.style.cursor = 'grab';
      } else {
        viewport.style.overflow = 'hidden';
        viewport.style.cursor = 'default';
      }
      viewportSpacer.style.margin = 'auto';
    }

    window.addEventListener('resize', updateScaling);

    zoomBtn.addEventListener('click', () => {
      const modes = ['fit', 1, 1.5];
      const nextIdx = (modes.indexOf(zoomMode) + 1) % modes.length;
      zoomMode = modes[nextIdx];
      zoomBtn.textContent = zoomMode === 'fit' ? '🔍 Fit' : (zoomMode === 1 ? '🔍 100%' : '🔍 150%');
      updateScaling();
    });

    fsBtn.addEventListener('click', () => {
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      } else {
        document.documentElement.requestFullscreen?.();
      }
    });

    document.addEventListener('fullscreenchange', () => {
      const isFs = !!document.fullscreenElement;
      fsBtn.textContent = isFs ? '⛶ Exit' : '⛶ Fullscreen';
      setTimeout(updateScaling, 50);
    });

    // Setup grab-to-pan in standalone player
    let isPanning = false;
    let startX = 0, startY = 0, startScrollLeft = 0, startScrollTop = 0;
    viewport.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || viewport.style.overflow !== 'auto') return;
      isPanning = true;
      startX = e.clientX;
      startY = e.clientY;
      startScrollLeft = viewport.scrollLeft;
      startScrollTop = viewport.scrollTop;
      viewport.style.cursor = 'grabbing';
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      viewport.scrollLeft = startScrollLeft - (e.clientX - startX);
      viewport.scrollTop = startScrollTop - (e.clientY - startY);
    });
    window.addEventListener('mouseup', () => {
      if (isPanning) {
        isPanning = false;
        viewport.style.cursor = viewport.style.overflow === 'auto' ? 'grab' : 'default';
      }
    });

    let iframeDoc = null;
    let idToNode = new Map();
    let currentTimeMs = 0;
    let currentEventIndex = 0;
    let isPlaying = false;
    let playbackSpeed = 1;
    let animationFrameId = null;
    let lastRafTimestamp = 0;

    function formatTime(ms) {
      const totalSec = Math.floor(ms / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }

    timeTotal.textContent = formatTime(totalDurationMs);

    function initDoc() {
      updateScaling();
      iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>');
      iframeDoc.close();
      resetToStart();
    }

    function buildNode(node) {
      if (node.type === 'text') {
        const t = iframeDoc.createTextNode(node.textContent || '');
        idToNode.set(node.id, t);
        return t;
      }
      if (node.type === 'element' && node.tagName) {
        const el = iframeDoc.createElement(node.tagName);
        idToNode.set(node.id, el);
        if (node.attributes) {
          for (const [k, v] of Object.entries(node.attributes)) {
            try { if (!k.startsWith('on') && k !== 'action') el.setAttribute(k, v); } catch(e){}
          }
        }
        if (node.children) {
          for (const child of node.children) {
            const c = buildNode(child);
            if (c) el.appendChild(c);
          }
        }
        if (node.isInput) {
          const tag = el.tagName ? el.tagName.toLowerCase() : '';
          if (tag === 'select') {
            if (node.value !== undefined) el.value = String(node.value);
            if (node.selectedIndex !== undefined && el.selectedIndex !== node.selectedIndex) {
              el.selectedIndex = node.selectedIndex;
            }
            if (el.options) {
              for (let i = 0; i < el.options.length; i++) {
                const opt = el.options[i];
                if (node.value !== undefined && opt.value === String(node.value)) opt.selected = true;
                else if (node.selectedIndex !== undefined && i === node.selectedIndex) opt.selected = true;
              }
            }
          } else if (el.type === 'checkbox' || el.type === 'radio') {
            el.checked = !!node.value;
          } else if (node.value !== undefined) {
            el.value = String(node.value);
          }
        }
        return el;
      }
      return null;
    }

    function resetToStart() {
      currentTimeMs = 0;
      currentEventIndex = 0;
      idToNode.clear();
      cursor.style.display = 'none';

      const sel = iframeDoc.getSelection();
      if (sel) sel.removeAllRanges();

      if (snap && snap.data) {
        const root = buildNode(snap.data);
        if (root && iframeDoc.documentElement) {
          iframeDoc.replaceChild(root, iframeDoc.documentElement);
          const style = iframeDoc.createElement('style');
          style.textContent = '* { pointer-events: none !important; }';
          iframeDoc.head.appendChild(style);
        }
      }

      // Auto-scroll to initial recorded position
      if (iframe.contentWindow) {
        try { iframe.contentWindow.scrollTo(initialScrollX, initialScrollY); } catch(e){}
      }

      if (cameraVideo) {
        cameraVideo.currentTime = 0;
        const firstCam = events.find(e => e.type === 'camera_position');
        if (cameraWrapper && firstCam) {
          cameraWrapper.style.width = firstCam.width + 'px';
          cameraWrapper.style.height = firstCam.height + 'px';
          cameraWrapper.style.left = firstCam.x + 'px';
          cameraWrapper.style.top = firstCam.y + 'px';
          cameraWrapper.style.borderRadius = firstCam.shape === 'rect' ? '12px' : '50%';
        }
      }
      updateUi();
    }

    function updateUi() {
      timeCurrent.textContent = formatTime(currentTimeMs);
      progressBar.value = (currentTimeMs / totalDurationMs) * 1000;
    }

    function applyEvent(ev) {
      if (!iframeDoc) return;
      if (ev.type === 'mutation') {
        if (ev.removedNodeIds) {
          for (const id of ev.removedNodeIds) {
            const n = idToNode.get(id);
            if (n && n.parentNode) { n.parentNode.removeChild(n); idToNode.delete(id); }
          }
        }
        if (ev.addedNodes) {
          for (const item of ev.addedNodes) {
            const parent = idToNode.get(item.parentId);
            if (parent && parent.nodeType === 1) {
              const newNode = buildNode(item.node);
              if (newNode) {
                const next = item.nextSiblingId ? idToNode.get(item.nextSiblingId) : null;
                parent.insertBefore(newNode, next || null);
              }
            }
          }
        }
        if (ev.attributeChanges) {
          for (const attr of ev.attributeChanges) {
            const el = idToNode.get(attr.nodeId);
            if (el && el.nodeType === 1) {
              if (attr.value === null) el.removeAttribute(attr.name);
              else try { el.setAttribute(attr.name, attr.value); } catch(e){}
            }
          }
        }
        if (ev.textChanges) {
          for (const txt of ev.textChanges) {
            const el = idToNode.get(txt.nodeId);
            if (el) el.textContent = txt.value;
          }
        }
      } else if (ev.type === 'mouse_move') {
        cursor.style.display = 'block';
        cursor.style.left = ev.x + 'px';
        cursor.style.top = ev.y + 'px';
        if (viewport.style.overflow === 'auto') {
          const cursorScreenX = ev.x * currentScale;
          const cursorScreenY = ev.y * currentScale;
          const vLeft = viewport.scrollLeft;
          const vTop = viewport.scrollTop;
          const vW = viewport.clientWidth;
          const vH = viewport.clientHeight;
          if (cursorScreenX < vLeft + 40 || cursorScreenX > vLeft + vW - 40) {
            viewport.scrollLeft = Math.max(0, cursorScreenX - vW / 2);
          }
          if (cursorScreenY < vTop + 40 || cursorScreenY > vTop + vH - 40) {
            viewport.scrollTop = Math.max(0, cursorScreenY - vH / 2);
          }
        }
      } else if (ev.type === 'mouse_click') {
        cursor.style.display = 'block';
        cursor.style.left = ev.x + 'px';
        cursor.style.top = ev.y + 'px';
      } else if (ev.type === 'scroll') {
        // Auto-scroll viewport to exact recorded position
        if (iframe.contentWindow) {
          try { iframe.contentWindow.scrollTo(ev.x, ev.y); } catch(e){}
        }
      } else if (ev.type === 'resize') {
        viewW = ev.width;
        viewH = ev.height;
        viewBadge.textContent = 'View: ' + viewW + ' × ' + viewH;
        viewportWrapper.style.width = viewW + 'px';
        viewportWrapper.style.height = viewH + 'px';
        iframe.style.width = viewW + 'px';
        iframe.style.height = viewH + 'px';
        updateScaling();
      } else if (ev.type === 'input') {
        const el = idToNode.get(ev.targetId);
        if (el) {
          const tag = el.tagName ? el.tagName.toLowerCase() : '';
          if (tag === 'select') {
            el.value = String(ev.value);
            if (ev.selectedIndex !== undefined && el.selectedIndex !== ev.selectedIndex) {
              el.selectedIndex = ev.selectedIndex;
            }
            if (el.options) {
              for (let i = 0; i < el.options.length; i++) {
                const opt = el.options[i];
                if (opt.value === String(ev.value) || (ev.selectedIndex !== undefined && i === ev.selectedIndex)) {
                  opt.selected = true;
                } else {
                  opt.selected = false;
                }
              }
            }
            try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch(e){}
          } else if (el.type === 'checkbox' || el.type === 'radio') {
            el.checked = !!ev.checked;
          } else {
            el.value = String(ev.value);
          }
        }
      } else if (ev.type === 'selection') {
        const sel = iframeDoc.getSelection();
        if (sel) {
          sel.removeAllRanges();
          if (ev.ranges && ev.ranges.length > 0) {
            for (const r of ev.ranges) {
              const startNode = idToNode.get(r.startNodeId);
              const endNode = idToNode.get(r.endNodeId);
              if (startNode && endNode) {
                try {
                  const range = iframeDoc.createRange();
                  const startMax = startNode.nodeType === 3 ? (startNode.textContent ? startNode.textContent.length : 0) : startNode.childNodes.length;
                  const endMax = endNode.nodeType === 3 ? (endNode.textContent ? endNode.textContent.length : 0) : endNode.childNodes.length;
                  range.setStart(startNode, Math.min(r.startOffset, startMax));
                  range.setEnd(endNode, Math.min(r.endOffset, endMax));
                  sel.addRange(range);
                } catch(e){}
              }
            }
          }
        }
      } else if (ev.type === 'camera_position') {
        if (cameraWrapper) {
          cameraWrapper.style.display = 'block';
          cameraWrapper.style.left = ev.x + 'px';
          cameraWrapper.style.top = ev.y + 'px';
          cameraWrapper.style.width = ev.width + 'px';
          cameraWrapper.style.height = ev.height + 'px';
          cameraWrapper.style.borderRadius = ev.shape === 'rect' ? '12px' : '50%';
          if (cameraVideo && ev.isMuted !== undefined) {
            cameraVideo.style.opacity = ev.isMuted ? '0.2' : '1';
          }
        }
      }
    }

    function dispatchEventsUpTo(time) {
      while (currentEventIndex < events.length) {
        const ev = events[currentEventIndex];
        if (ev.timestamp > time) break;
        applyEvent(ev);
        currentEventIndex++;
      }
    }

    function play() {
      if (isPlaying) return;
      if (currentTimeMs >= totalDurationMs) resetToStart();
      isPlaying = true;
      playBtn.textContent = 'Pause';
      lastRafTimestamp = performance.now();

      if (cameraVideo) {
        cameraVideo.playbackRate = playbackSpeed;
        cameraVideo.play().catch(function(){});
      }

      function loop(now) {
        if (!isPlaying) return;
        const delta = (now - lastRafTimestamp) * playbackSpeed;
        lastRafTimestamp = now;
        currentTimeMs = Math.min(totalDurationMs, currentTimeMs + delta);
        dispatchEventsUpTo(currentTimeMs);
        updateUi();

        if (cameraVideo && Number.isFinite(cameraVideo.currentTime)) {
          var expected = currentTimeMs / 1000;
          if (Math.abs(cameraVideo.currentTime - expected) > 0.3) {
            cameraVideo.currentTime = expected;
          }
        }

        if (currentTimeMs >= totalDurationMs) {
          pause();
          return;
        }
        animationFrameId = requestAnimationFrame(loop);
      }
      animationFrameId = requestAnimationFrame(loop);
    }

    function pause() {
      if (!isPlaying) return;
      isPlaying = false;
      playBtn.textContent = 'Play';
      if (cameraVideo) {
        cameraVideo.pause();
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    }

    playBtn.addEventListener('click', () => {
      if (isPlaying) pause(); else play();
    });

    progressBar.addEventListener('input', (e) => {
      const wasPlaying = isPlaying;
      pause();
      const targetTime = (parseFloat(e.target.value) / 1000) * totalDurationMs;
      resetToStart();
      dispatchEventsUpTo(targetTime);
      currentTimeMs = targetTime;
      if (cameraVideo) {
        cameraVideo.currentTime = Math.max(0, targetTime / 1000);
      }
      updateUi();
      if (wasPlaying) play();
    });

    speedBtn.addEventListener('click', () => {
      playbackSpeed = playbackSpeed === 1 ? 2 : playbackSpeed === 2 ? 0.5 : 1;
      speedBtn.textContent = playbackSpeed + 'x Speed';
      if (cameraVideo) {
        cameraVideo.playbackRate = playbackSpeed;
      }
    });

    const diagnostics = ${jsonDiagnostics};
    const diagDrawer = document.getElementById('diagDrawer');
    const diagBtn = document.getElementById('diagBtn');
    const diagList = document.getElementById('diagList');
    const diagSearchInput = document.getElementById('diagSearchInput');
    const timelineMarkers = document.getElementById('timelineMarkers');
    const diagCountPill = document.getElementById('diagCountPill');

    const errCount = diagnostics.filter(e => e.level === 'error').length;
    const warnCount = diagnostics.filter(e => e.level === 'warn').length;
    if (errCount > 0 || warnCount > 0) {
      diagBtn.classList.add('has-issues');
    }
    diagBtn.textContent = '🐞 Diag' + (diagnostics.length > 0 ? ' (' + diagnostics.length + ')' : '');
    if (diagCountPill) diagCountPill.textContent = '(' + diagnostics.length + ' events)';

    function seekTo(targetTime) {
      const wasPlaying = isPlaying;
      pause();
      resetToStart();
      dispatchEventsUpTo(targetTime);
      currentTimeMs = targetTime;
      updateUi();
      if (wasPlaying) play();
    }

    function escapeHtml(str) {
      return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Render timeline markers
    if (timelineMarkers) {
      timelineMarkers.innerHTML = '';
      diagnostics.forEach((entry, idx) => {
        const entryTime = entry.timestampMs !== undefined ? entry.timestampMs : (entry.timestamp || 0);
        const pct = Math.min(100, Math.max(0, (entryTime / totalDurationMs) * 100));
        const marker = document.createElement('div');
        marker.className = 'sat-timeline-marker sat-marker-' + entry.level;
        marker.style.left = pct + '%';

        const tooltip = document.createElement('div');
        tooltip.className = 'sat-marker-tooltip';
        const timeStr = formatTime(entryTime);
        const label = entry.source === 'fetch' || entry.source === 'xhr'
          ? '[' + timeStr + '] ' + (entry.method || 'REQ') + ' ' + (entry.status || '') + ' ' + (entry.url || '')
          : '[' + timeStr + '] ' + entry.message;
        tooltip.textContent = label;
        marker.appendChild(tooltip);

        marker.addEventListener('click', (e) => {
          e.stopPropagation();
          seekTo(entryTime);
          if (diagDrawer) diagDrawer.style.display = 'flex';
          diagBtn.classList.add('is-active');
          highlightDiagItem(idx);
        });

        timelineMarkers.appendChild(marker);
      });
    }

    let currentFilter = 'all';
    let currentSearch = '';

    function highlightDiagItem(idx) {
      if (!diagList) return;
      const items = diagList.querySelectorAll('.sat-diag-item');
      items.forEach(item => {
        if (item.dataset.index === String(idx)) {
          item.classList.add('sat-diag-active');
          item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
          item.classList.remove('sat-diag-active');
        }
      });
    }

    function renderDiagList() {
      if (!diagList) return;
      diagList.innerHTML = '';

      const filtered = diagnostics.map((item, originalIndex) => ({ item, originalIndex })).filter(({ item }) => {
        if (currentFilter === 'error' && item.level !== 'error') return false;
        if (currentFilter === 'warn' && item.level !== 'warn') return false;
        if (currentFilter === 'net' && item.source !== 'fetch' && item.source !== 'xhr') return false;

        if (currentSearch) {
          const q = currentSearch.toLowerCase();
          const matchMsg = (item.message || '').toLowerCase().includes(q);
          const matchUrl = (item.url || '').toLowerCase().includes(q);
          return matchMsg || matchUrl;
        }
        return true;
      });

      if (filtered.length === 0) {
        diagList.innerHTML = '<div class="sat-diag-empty">No diagnostics match the filter criteria.</div>';
        return;
      }

      filtered.forEach(({ item, originalIndex }) => {
        const row = document.createElement('div');
        row.className = 'sat-diag-item sat-diag-item-' + item.level;
        row.dataset.index = String(originalIndex);
        const itemTime = item.timestampMs !== undefined ? item.timestampMs : (item.timestamp || 0);

        const timeStr = formatTime(itemTime);
        const badgeClass = 'sat-badge-' + item.level;
        const badgeText = item.source === 'fetch' || item.source === 'xhr'
          ? 'HTTP ' + (item.status || 'ERR')
          : item.level.toUpperCase();

        const contentText = item.source === 'fetch' || item.source === 'xhr'
          ? (item.method || 'GET') + ' ' + item.url + (item.durationMs ? ' (' + item.durationMs + 'ms)' : '')
          : item.message;

        row.innerHTML = 
          '<button class="sat-diag-time-btn" title="Seek to ' + timeStr + '">⏱ ' + timeStr + '</button>' +
          '<span class="sat-diag-badge ' + badgeClass + '">' + badgeText + '</span>' +
          '<span class="sat-diag-content" title="' + escapeHtml(contentText) + '">' + escapeHtml(contentText) + '</span>';

        row.addEventListener('click', () => {
          seekTo(itemTime);
          highlightDiagItem(originalIndex);
        });

        diagList.appendChild(row);
      });
    }

    renderDiagList();

    const filterBtns = diagDrawer ? diagDrawer.querySelectorAll('.sat-diag-filter-btn') : [];
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.getAttribute('data-filter') || 'all';
        renderDiagList();
      });
    });

    if (diagSearchInput) {
      diagSearchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value.trim();
        renderDiagList();
      });
    }

    if (diagBtn && diagDrawer) {
      diagBtn.addEventListener('click', () => {
        const isHidden = diagDrawer.style.display === 'none';
        diagDrawer.style.display = isHidden ? 'flex' : 'none';
        diagBtn.classList.toggle('is-active', isHidden);
      });
    }

    window.addEventListener('load', initDoc);
    if (document.readyState === 'complete') initDoc();
  </script>
</body>
</html>`;
}
