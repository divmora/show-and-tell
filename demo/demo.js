document.addEventListener('DOMContentLoaded', () => {
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');
  const btnReloadTest = document.getElementById('btnReloadTest');
  const btnCheckRecovery = document.getElementById('btnCheckRecovery');
  const btnClearStorage = document.getElementById('btnClearStorage');

  const maxDurationSelect = document.getElementById('maxDuration');
  const warningThresholdInput = document.getElementById('warningThreshold');
  const recordingModeSelect = document.getElementById('recordingMode');
  const micAudioCheckbox = document.getElementById('micAudio');
  const systemAudioCheckbox = document.getElementById('systemAudio');
  const systemAudioLabel = document.getElementById('systemAudioLabel');
  const cameraOptionCheckbox = document.getElementById('cameraOption');
  const cameraConfigGroup = document.getElementById('cameraConfigGroup');
  const cameraShape = document.getElementById('cameraShape');
  const cameraSize = document.getElementById('cameraSize');
  const cameraPosition = document.getElementById('cameraPosition');
  const alwaysOnTopOption = document.getElementById('alwaysOnTopOption');
  const diagnosticsOptionCheckbox = document.getElementById('diagnosticsOption');
  const countdownOption = document.getElementById('countdownOption');
  const audioMeterOption = document.getElementById('audioMeterOption');
  const clickRippleOption = document.getElementById('clickRippleOption');
  const spotlightOption = document.getElementById('spotlightOption');
  const floatingUiCheckbox = document.getElementById('floatingUi');
  const previewModalCheckbox = document.getElementById('previewModal');
  const storagePersistenceCheckbox = document.getElementById('storagePersistence');
  const domMaskInputs = document.getElementById('domMaskInputs');
  const domMaskLabel = document.getElementById('domMaskLabel');
  const uploadModeSelect = document.getElementById('uploadMode');
  const mobileNotice = document.getElementById('mobileNotice');
  const btnStartText = document.getElementById('btnStartText');

  // Theme Customizer Elements
  const themeModeSelect = document.getElementById('themeMode');
  const themeBorderRadiusSelect = document.getElementById('themeBorderRadius');
  const themePrimaryColorInput = document.getElementById('themePrimaryColor');
  const btnApplyTheme = document.getElementById('btnApplyTheme');
  const btnResetTheme = document.getElementById('btnResetTheme');
  const themePresetButtons = document.querySelectorAll('.btn-theme-preset');

  function getSelectedTheme() {
    return {
      mode: themeModeSelect?.value || 'dark',
      borderRadius: themeBorderRadiusSelect?.value || '12px',
      primaryColor: themePrimaryColorInput?.value || '#3b82f6'
    };
  }

  const embedCodeSnippet = document.getElementById('embedCodeSnippet');
  const snippetModeBadge = document.getElementById('snippetModeBadge');
  const btnCopySnippet = document.getElementById('btnCopySnippet');
  const btnCopyText = document.getElementById('btnCopyText');

  const statusMode = document.getElementById('statusMode');
  const statusState = document.getElementById('statusState');
  const statusElapsed = document.getElementById('statusElapsed');
  const statusRemaining = document.getElementById('statusRemaining');
  const statusCodec = document.getElementById('statusCodec');
  const statusChunks = document.getElementById('statusChunks');
  const progressBar = document.getElementById('progressBar');

  // Test sandbox interactive counter & simulation triggers
  const testCounterBtn = document.getElementById('testCounterBtn');
  const testCounterVal = document.getElementById('testCounterVal');
  const btnTriggerConsoleError = document.getElementById('btnTriggerConsoleError');
  const btnTriggerConsoleWarn = document.getElementById('btnTriggerConsoleWarn');
  const btnTriggerNetworkError = document.getElementById('btnTriggerNetworkError');
  const btnTriggerUncaughtError = document.getElementById('btnTriggerUncaughtError');
  const diagSimLog = document.getElementById('diagSimLog');

  let clickCount = 0;
  testCounterBtn?.addEventListener('click', () => {
    clickCount++;
    if (testCounterVal) testCounterVal.textContent = clickCount.toString();
  });

  btnTriggerConsoleError?.addEventListener('click', () => {
    console.error('[Demo Simulation] UI action rejected: Payment gateway returned error code #PAY_TIMEOUT_408');
    if (diagSimLog) diagSimLog.textContent = `[${new Date().toLocaleTimeString()}] Fired console.error (recorded in diagnostics breadcrumbs)`;
  });

  btnTriggerConsoleWarn?.addEventListener('click', () => {
    console.warn('[Demo Simulation] Performance warning: heavy layout reflow on element #dom-test-surface');
    if (diagSimLog) diagSimLog.textContent = `[${new Date().toLocaleTimeString()}] Fired console.warn (recorded in diagnostics breadcrumbs)`;
  });

  btnTriggerNetworkError?.addEventListener('click', () => {
    fetch('/api/simulate-failure?status=500&error=DatabaseConnectionTimeout', { method: 'POST' }).catch(() => {});
    if (diagSimLog) diagSimLog.textContent = `[${new Date().toLocaleTimeString()}] Dispatched failed POST fetch /api/simulate-failure (recorded in diagnostics)`;
  });

  btnTriggerUncaughtError?.addEventListener('click', () => {
    if (diagSimLog) diagSimLog.textContent = `[${new Date().toLocaleTimeString()}] Dispatched uncaught background error (recorded in diagnostics)`;
    setTimeout(() => {
      throw new Error('[Demo Simulation] Uncaught TypeError: Cannot read properties of undefined (reading "executeSync")');
    }, 0);
  });

  // Dynamic Ready-to-Use JavaScript Embed Code Generator
  function updateCodeSnippet() {
    if (!embedCodeSnippet) return;
    const mode = recordingModeSelect?.value || 'auto';
    const isDom = mode === 'dom';
    const isAuto = mode === 'auto';
    const maxDur = parseInt(maxDurationSelect?.value || '0', 10);
    const warnThresh = parseInt(warningThresholdInput?.value || '5', 10) || 5;
    const mic = micAudioCheckbox ? micAudioCheckbox.checked : true;
    const sys = systemAudioCheckbox ? systemAudioCheckbox.checked : true;
    const cam = cameraOptionCheckbox ? cameraOptionCheckbox.checked : false;
    const shape = cameraShape?.value || 'circle';
    const size = cameraSize?.value ? parseInt(cameraSize.value, 10) : 160;
    const pos = cameraPosition?.value || 'bottom-left';
    const aot = alwaysOnTopOption ? alwaysOnTopOption.checked : true;
    const diag = diagnosticsOptionCheckbox ? diagnosticsOptionCheckbox.checked : true;
    const countdown = countdownOption ? countdownOption.checked : true;
    const audioMeter = audioMeterOption ? audioMeterOption.checked : true;
    const ui = floatingUiCheckbox ? floatingUiCheckbox.checked : true;
    const preview = previewModalCheckbox ? previewModalCheckbox.checked : true;
    const storage = storagePersistenceCheckbox ? storagePersistenceCheckbox.checked : true;
    const maskInputs = domMaskInputs ? domMaskInputs.checked : true;
    const uploadMode = uploadModeSelect?.value || 'presigned';

    if (snippetModeBadge) {
      if (isAuto) {
        snippetModeBadge.textContent = 'Auto Mode (Universal Desktop Video & Mobile Replay)';
        snippetModeBadge.style.background = 'rgba(168, 85, 247, 0.15)';
        snippetModeBadge.style.borderColor = 'rgba(168, 85, 247, 0.4)';
        snippetModeBadge.style.color = '#c084fc';
      } else if (isDom) {
        snippetModeBadge.textContent = 'DOM Mode Config (Session Replay - Zero Permission)';
        snippetModeBadge.style.background = 'rgba(16, 185, 129, 0.15)';
        snippetModeBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        snippetModeBadge.style.color = '#34d399';
      } else {
        snippetModeBadge.textContent = 'Pixel Mode Config (Screen Capture - Desktop)';
        snippetModeBadge.style.background = 'rgba(59, 130, 246, 0.15)';
        snippetModeBadge.style.borderColor = 'rgba(59, 130, 246, 0.4)';
        snippetModeBadge.style.color = '#60a5fa';
      }
    }

    let code = `// 1. Include ShowAndTell SDK via CDN or npm\n`;
    code += `// <script src="https://cdn.jsdelivr.net/npm/@divmora/show-and-tell/dist/show-and-tell.min.js"><\/script>\n`;
    code += `// or: import { ShowAndTell } from '@divmora/show-and-tell';\n\n`;
    code += `// 2. Initialize recording session with your chosen options\n`;
    code += `const session = await window.ShowAndTell.startRecording({\n`;
    code += `  mode: '${mode}', // 'auto' dynamically selects screen capture on desktop and DOM replay on mobile\n`;
    code += `  fallbackToDom: true, // Seamlessly fallback to DOM recording if screen capture is unsupported\n`;

    if (maxDur > 0) {
      code += `  maxDuration: ${maxDur}, // Stop automatically after ${maxDur}s\n`;
      code += `  warningThreshold: ${warnThresh}, // Warning countdown alert when ${warnThresh}s remain\n`;
    }

    if (isDom) {
      code += `  dom: {\n`;
      code += `    maskAllInputs: ${maskInputs}, // ${maskInputs ? 'Masks passwords & input fields' : 'Inputs unmasked'}\n`;
      code += `    maskTextClass: 'sat-mask',\n`;
      code += `    unmaskClass: 'sat-unmask',\n`;
      code += `    maskSelector: '#aadharInput, .pan-input, #aadharTextDisplay, .pan-text-display'\n`;
      code += `  },\n`;
      code += `  audio: {\n`;
      code += `    mic: ${mic},\n`;
      code += `  },\n`;
    } else {
      code += `  audio: {\n`;
      code += `    mic: ${mic},\n`;
      code += `    system: ${sys},\n`;
      code += `  },\n`;
    }

    if (cam) {
      code += `  camera: {\n`;
      code += `    shape: '${shape}', // '${shape === 'rect' ? '16:9 Google Meet style landscape' : 'circle'}'\n`;
      code += `    size: ${size},\n`;
      code += `    position: '${pos}',\n`;
      code += `    alwaysOnTop: ${aot}, // Float over all apps via Picture-in-Picture\n`;
      code += `  },\n`;
    } else {
      code += `  camera: false,\n`;
    }

    code += `  alwaysOnTop: ${aot}, // OS-level floating PiP toolbar across windows & tabs\n`;
    code += `  diagnostics: ${diag}, // Developer console & network breadcrumbs\n`;
    code += `  countdown: ${countdown ? 3 : 0}, // Pre-recording 3-2-1 countdown overlay with audio ticks\n`;
    code += `  audioMeter: ${audioMeter}, // Real-time microphone VU meter & silent mic alert\n`;
    code += `  ui: ${ui}, // Floating draggable recording toolbar\n`;
    code += `  previewModal: ${preview}, // Post-recording playback & export modal\n`;
    code += `  storage: ${storage}, // IndexedDB crash & reload recovery\n`;
    if (uploadMode === 'presigned') {
      code += `  // Direct Presigned Upload (AWS S3 / Cloudflare R2 / Supabase)\n`;
      code += `  upload: {\n`;
      code += `    getPresignedUrl: async (context) => {\n`;
      code += `      const res = await fetch('/api/upload/presigned-url', {\n`;
      code += `        method: 'POST',\n`;
      code += `        headers: { 'Content-Type': 'application/json' },\n`;
      code += `        body: JSON.stringify(context)\n`;
      code += `      });\n`;
      code += `      return res.json();\n`;
      code += `    },\n`;
      code += `    onProgress: ({ percent, fileType }) => console.log(\`Uploading \${fileType}: \${percent}%\`),\n`;
      code += `  },\n`;
    } else if (uploadMode === 'server') {
      code += `  uploadEndpoint: '/api/upload', // Traditional multipart server upload\n`;
    }

    const theme = getSelectedTheme();
    if (theme.mode !== 'dark' || theme.primaryColor !== '#3b82f6' || theme.borderRadius !== '12px') {
      code += `  theme: {\n    mode: '${theme.mode}',\n    primaryColor: '${theme.primaryColor}',\n    borderRadius: '${theme.borderRadius}'\n  },\n`;
    }

    code += `});\n\n`;

    code += `// 3. Listen to session lifecycle events\n`;
    code += `session.on('tick', ({ formattedElapsed, formattedRemaining }) => {\n`;
    code += `  console.log(\`[ShowAndTell] Elapsed: \${formattedElapsed} | Remaining: \${formattedRemaining || 'Unlimited'}\`);\n`;
    code += `});\n\n`;

    if (isDom) {
      code += `session.on('stop', (result) => {\n`;
      code += `  console.log('Session Replay finished:', result);\n`;
      code += `  // Export DOM event log as JSON:\n`;
      code += `  result.download('session-replay.json');\n`;
      code += `  // Or access raw events:\n`;
      code += `  // console.log(result.events);\n`;
      code += `});\n`;
    } else {
      code += `session.on('stop', (result) => {\n`;
      code += `  console.log('Screen Recording finished:', result);\n`;
      code += `  // Download WebM / MP4 video:\n`;
      code += `  result.download('screen-recording.webm');\n`;
      code += `  // Or access raw Blob:\n`;
      code += `  // const blob = result.blob;\n`;
      code += `});\n`;
    }

    embedCodeSnippet.textContent = code;
  }

  // Copy-to-Clipboard Handler
  btnCopySnippet?.addEventListener('click', async () => {
    const code = embedCodeSnippet?.textContent || '';
    if (!code) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    if (btnCopyText) btnCopyText.textContent = 'Copied!';
    btnCopySnippet.style.background = 'rgba(16, 185, 129, 0.25)';
    btnCopySnippet.style.borderColor = 'rgba(16, 185, 129, 0.5)';
    btnCopySnippet.style.color = '#34d399';
    setTimeout(() => {
      if (btnCopyText) btnCopyText.textContent = 'Copy Code';
      btnCopySnippet.style.background = 'rgba(59, 130, 246, 0.2)';
      btnCopySnippet.style.borderColor = 'rgba(59, 130, 246, 0.4)';
      btnCopySnippet.style.color = '#60a5fa';
    }, 2000);
  });

  // Handle Mode Change
  function updateModeUi() {
    const mode = recordingModeSelect?.value || 'auto';
    const isMobileDevice = window.ShowAndTell?.isMobile ? window.ShowAndTell.isMobile() : /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
    const isScreenCaptureSupported = window.ShowAndTell?.isScreenCaptureSupported ? window.ShowAndTell.isScreenCaptureSupported() : (typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function');

    if (mobileNotice) {
      mobileNotice.style.display = (!isScreenCaptureSupported || isMobileDevice) ? 'block' : 'none';
    }

    const effectiveDom = mode === 'dom' || (mode === 'auto' && !isScreenCaptureSupported);
    const cameraLabelText = document.getElementById('cameraLabelText');

    if (effectiveDom) {
      if (btnStartText) {
        btnStartText.textContent = mode === 'auto'
          ? 'Start Recording (Auto DOM Replay)'
          : 'Start In-App DOM Recording (0-Permission)';
      }
      if (statusMode) {
        statusMode.textContent = mode === 'auto' ? 'AUTO (DOM REPLAY)' : 'DOM (SESSION REPLAY)';
        statusMode.style.color = '#10b981';
      }
      if (domMaskLabel) domMaskLabel.style.display = 'flex';
      if (systemAudioLabel) systemAudioLabel.style.opacity = '0.5';
      if (statusCodec) statusCodec.textContent = 'application/json';
      if (cameraLabelText) {
        cameraLabelText.textContent = 'Enable PiP Webcam Facecam (Synchronized Replay in DOM mode — Off by default)';
      }
      if (cameraOptionCheckbox && isMobileDevice) {
        cameraOptionCheckbox.checked = false;
        if (cameraConfigGroup) cameraConfigGroup.style.display = 'none';
      }
    } else {
      if (btnStartText) {
        btnStartText.textContent = mode === 'auto'
          ? 'Start Recording (Auto Screen Share)'
          : 'Start Screen Recording';
      }
      if (statusMode) {
        statusMode.textContent = mode === 'auto' ? 'AUTO (PIXEL VIDEO)' : 'PIXEL (VIDEO)';
        statusMode.style.color = '#60a5fa';
      }
      if (domMaskLabel) domMaskLabel.style.display = 'none';
      if (systemAudioLabel) systemAudioLabel.style.opacity = '1';
      if (statusCodec) {
        statusCodec.textContent = window.ShowAndTell?.getPreferredMimeType ? window.ShowAndTell.getPreferredMimeType() : 'Auto-negotiated';
      }
      if (cameraLabelText) {
        cameraLabelText.textContent = 'Enable PiP Webcam Facecam (Floating Avatar / Google Meet Style)';
      }
    }
    updateCodeSnippet();
  }

  cameraOptionCheckbox?.addEventListener('change', () => {
    if (cameraConfigGroup) {
      cameraConfigGroup.style.display = cameraOptionCheckbox.checked ? 'flex' : 'none';
    }
  });

  // Wire all configuration controls to update code snippet in real-time
  const snippetTriggerElements = [
    recordingModeSelect,
    maxDurationSelect,
    warningThresholdInput,
    micAudioCheckbox,
    systemAudioCheckbox,
    cameraOptionCheckbox,
    cameraShape,
    cameraSize,
    cameraPosition,
    alwaysOnTopOption,
    diagnosticsOptionCheckbox,
    countdownOption,
    audioMeterOption,
    clickRippleOption,
    spotlightOption,
    floatingUiCheckbox,
    previewModalCheckbox,
    storagePersistenceCheckbox,
    domMaskInputs,
    uploadModeSelect,
    themeModeSelect,
    themeBorderRadiusSelect,
    themePrimaryColorInput
  ];

  snippetTriggerElements.forEach((el) => {
    if (!el) return;
    el.addEventListener('change', updateCodeSnippet);
    if (el.tagName === 'INPUT' && (el.type === 'number' || el.type === 'text' || el.type === 'color')) {
      el.addEventListener('input', updateCodeSnippet);
    }
  });

  // Theme preset buttons & live controls
  themePresetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const color = btn.getAttribute('data-color');
      if (color && themePrimaryColorInput) {
        themePrimaryColorInput.value = color;
        updateCodeSnippet();
        if (window.ShowAndTell?.setTheme) {
          window.ShowAndTell.setTheme(getSelectedTheme());
        }
      }
    });
  });

  btnApplyTheme?.addEventListener('click', () => {
    if (window.ShowAndTell?.setTheme) {
      window.ShowAndTell.setTheme(getSelectedTheme());
    }
  });

  btnResetTheme?.addEventListener('click', () => {
    if (themeModeSelect) themeModeSelect.value = 'dark';
    if (themeBorderRadiusSelect) themeBorderRadiusSelect.value = '12px';
    if (themePrimaryColorInput) themePrimaryColorInput.value = '#3b82f6';
    updateCodeSnippet();
    if (window.ShowAndTell?.setTheme) {
      window.ShowAndTell.setTheme(getSelectedTheme());
    }
  });

  [themeModeSelect, themeBorderRadiusSelect, themePrimaryColorInput].forEach((el) => {
    el?.addEventListener('input', () => {
      if (window.ShowAndTell?.setTheme) {
        window.ShowAndTell.setTheme(getSelectedTheme());
      }
    });
  });

  recordingModeSelect?.addEventListener('change', updateModeUi);
  updateModeUi();

  let activeSession = null;
  let chunkCounter = 0;

  function updateUiState(state) {
    statusState.textContent = state.toUpperCase();
    if (state === 'recording') {
      btnStart.disabled = true;
      btnStop.disabled = false;
      statusState.style.color = '#ef4444';
    } else if (state === 'paused') {
      btnStart.disabled = true;
      btnStop.disabled = false;
      statusState.style.color = '#f59e0b';
    } else {
      btnStart.disabled = false;
      btnStop.disabled = true;
      statusState.style.color = '#f0f6fc';
    }
  }

  btnStart.addEventListener('click', async () => {
    try {
      const mode = recordingModeSelect.value;
      const maxDurationVal = parseInt(maxDurationSelect.value, 10);
      const warningThresholdVal = parseInt(warningThresholdInput.value, 10) || 5;

      chunkCounter = 0;
      statusChunks.textContent = '0';
      progressBar.style.width = '0%';
      progressBar.classList.remove('warning');

      let uploadConfig = undefined;
      let uploadEndpoint = undefined;
      const uploadChoice = uploadModeSelect ? uploadModeSelect.value : 'presigned';

      if (uploadChoice === 'presigned' && !window.location.origin.includes('github.io')) {
        uploadConfig = {
          getPresignedUrl: async (context) => {
            const res = await fetch('/api/upload/presigned-url', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                filename: context.filename,
                mimeType: context.mimeType,
                size: context.size,
                fileType: context.fileType,
                method: 'PUT'
              })
            });
            if (!res.ok) throw new Error(`Failed to generate presigned upload ticket: HTTP ${res.status}`);
            return res.json();
          },
          onProgress: (p) => {
            console.log(`[ShowAndTell Demo] Presigned upload progress: ${p.percent}% (${p.fileType})`);
          }
        };
      } else if (uploadChoice === 'server' && !window.location.origin.includes('github.io')) {
        uploadEndpoint = '/api/upload';
      }

      activeSession = await window.ShowAndTell.startRecording({
        mode: mode,
        fallbackToDom: true,
        dom: {
          maskAllInputs: domMaskInputs ? domMaskInputs.checked : true,
          maskTextClass: 'sat-mask',
          unmaskClass: 'sat-unmask',
          maskSelector: '#aadharInput, .pan-input, #aadharTextDisplay, .pan-text-display'
        },
        maxDuration: maxDurationVal > 0 ? maxDurationVal : undefined,
        warningThreshold: warningThresholdVal,
        audio: {
          mic: micAudioCheckbox.checked,
          system: mode === 'pixel' ? systemAudioCheckbox.checked : false
        },
        camera: cameraOptionCheckbox?.checked ? {
          shape: cameraShape ? cameraShape.value : 'circle',
          size: cameraSize ? parseInt(cameraSize.value, 10) : 160,
          position: cameraPosition ? cameraPosition.value : 'bottom-left',
          alwaysOnTop: alwaysOnTopOption ? alwaysOnTopOption.checked : true
        } : false,
        alwaysOnTop: alwaysOnTopOption ? alwaysOnTopOption.checked : true,
        diagnostics: diagnosticsOptionCheckbox ? diagnosticsOptionCheckbox.checked : true,
        countdown: countdownOption ? (countdownOption.checked ? 3 : 0) : 3,
        audioMeter: audioMeterOption ? audioMeterOption.checked : true,
        clickRipple: clickRippleOption ? clickRippleOption.checked : true,
        spotlight: spotlightOption ? spotlightOption.checked : false,
        ui: floatingUiCheckbox.checked,
        previewModal: previewModalCheckbox.checked,
        storage: storagePersistenceCheckbox.checked,
        theme: getSelectedTheme(),
        upload: uploadConfig,
        uploadEndpoint: uploadEndpoint
      });

      updateUiState('recording');
      statusCodec.textContent = mode === 'dom' ? 'application/json' : (window.ShowAndTell.getPreferredMimeType ? window.ShowAndTell.getPreferredMimeType() : 'Active');

      activeSession.on('tick', (stats) => {
        statusElapsed.textContent = stats.formattedElapsed;
        if (stats.formattedMaxDuration) {
          statusRemaining.textContent = `${stats.formattedRemaining} (Max: ${stats.formattedMaxDuration})`;
        } else {
          statusRemaining.textContent = 'Unlimited';
        }

        if (stats.progressRatio !== undefined) {
          progressBar.style.width = `${Math.min(100, stats.progressRatio * 100)}%`;
        }

        if (stats.isWarning) {
          progressBar.classList.add('warning');
        } else {
          progressBar.classList.remove('warning');
        }

        updateUiState(stats.isPaused ? 'paused' : 'recording');
      });

      activeSession.on('chunk', () => {
        chunkCounter++;
        statusChunks.textContent = chunkCounter.toString();
      });

      activeSession.on('maxDurationReached', () => {
        console.log('[Demo] Max duration reached! Auto-discontinuing...');
      });

      activeSession.on('stop', (result) => {
        console.log('[Demo] Recording stopped:', result);
        updateUiState('stopped');
      });

    } catch (err) {
      console.error('[Demo] Failed to start recording:', err);
      if (err.message && err.message.includes('getDisplayMedia')) {
        alert(
          `Screen Capture Not Supported:\n\n${err.message}\n\nShowAndTell has switched your selection to DOM-Level Session Replay, which works reliably across all mobile browsers.`
        );
        if (recordingModeSelect) {
          recordingModeSelect.value = 'dom';
          updateModeUi();
        }
      } else {
        alert(`Error starting recording: ${err.message}`);
      }
      updateUiState('idle');
    }
  });

  btnStop.addEventListener('click', async () => {
    if (activeSession) {
      try {
        await activeSession.stop();
      } catch (err) {
        console.error('[Demo] Stop error:', err);
      }
    }
  });

  btnReloadTest.addEventListener('click', () => {
    if (!window.ShowAndTell.isRecording()) {
      alert('Start a recording first, then click reload to test recovery!');
      return;
    }
    window.location.reload();
  });

  btnCheckRecovery.addEventListener('click', async () => {
    const list = await window.ShowAndTell.getInterruptedRecordings();
    if (list.length === 0) {
      alert('No unsaved recordings found in IndexedDB.');
      return;
    }

    const session = list[list.length - 1];
    const confirm = window.confirm(
      `Found unsaved recording with ${session.chunkCount} chunks (${Math.round(session.totalBytes / 1024)} KB).\nClick OK to recover and download.`
    );
    if (confirm) {
      const res = await session.assemble();
      res.download();
      await session.discard();
    }
  });

  btnClearStorage.addEventListener('click', async () => {
    await window.ShowAndTell.clearAllStorage();
    alert('Local IndexedDB storage cleared.');
  });
});
