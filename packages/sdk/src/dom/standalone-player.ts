import { DomRecordingEvent } from '../types';

export interface StandalonePlayerOptions {
  events: DomRecordingEvent[];
  durationSeconds: number;
  sessionId: string;
  title?: string;
}

export function generateStandalonePlayerHtml(options: StandalonePlayerOptions): string {
  const jsonEvents = JSON.stringify(options.events).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
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
    .scrubber-container {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    input[type="range"] {
      flex: 1;
      accent-color: #3b82f6;
      cursor: pointer;
      height: 6px;
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

  <div class="player-controls">
    <button class="ctrl-btn" id="playBtn">Play</button>
    <div class="scrubber-container">
      <span class="time-display" id="timeCurrent">00:00</span>
      <input type="range" id="progressBar" min="0" max="1000" value="0">
      <span class="time-display" id="timeTotal">00:00</span>
    </div>
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
        if (node.isInput) {
          if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!node.value;
          else if (node.value !== undefined) el.value = String(node.value);
        }
        if (node.children) {
          for (const child of node.children) {
            const c = buildNode(child);
            if (c) el.appendChild(c);
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

      if (snap && snap.data) {
        const root = buildNode(snap.data);
        if (root && iframeDoc.documentElement) {
          iframeDoc.replaceChild(root, iframeDoc.documentElement);
          const style = iframeDoc.createElement('style');
          style.textContent = '* { pointer-events: none !important; user-select: none !important; }';
          iframeDoc.head.appendChild(style);
        }
      }

      // Auto-scroll to initial recorded position
      if (iframe.contentWindow) {
        try { iframe.contentWindow.scrollTo(initialScrollX, initialScrollY); } catch(e){}
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
          if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!ev.checked;
          else el.value = String(ev.value);
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

      function loop(now) {
        if (!isPlaying) return;
        const delta = (now - lastRafTimestamp) * playbackSpeed;
        lastRafTimestamp = now;
        currentTimeMs = Math.min(totalDurationMs, currentTimeMs + delta);
        dispatchEventsUpTo(currentTimeMs);
        updateUi();

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
      updateUi();
      if (wasPlaying) play();
    });

    speedBtn.addEventListener('click', () => {
      playbackSpeed = playbackSpeed === 1 ? 2 : playbackSpeed === 2 ? 0.5 : 1;
      speedBtn.textContent = playbackSpeed + 'x Speed';
    });

    window.addEventListener('load', initDoc);
    if (document.readyState === 'complete') initDoc();
  </script>
</body>
</html>`;
}
