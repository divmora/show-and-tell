document.addEventListener('DOMContentLoaded', () => {
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');
  const btnReloadTest = document.getElementById('btnReloadTest');
  const btnCheckRecovery = document.getElementById('btnCheckRecovery');
  const btnClearStorage = document.getElementById('btnClearStorage');

  const maxDurationSelect = document.getElementById('maxDuration');
  const warningThresholdInput = document.getElementById('warningThreshold');
  const micAudioCheckbox = document.getElementById('micAudio');
  const systemAudioCheckbox = document.getElementById('systemAudio');
  const floatingUiCheckbox = document.getElementById('floatingUi');
  const previewModalCheckbox = document.getElementById('previewModal');
  const storagePersistenceCheckbox = document.getElementById('storagePersistence');

  const statusState = document.getElementById('statusState');
  const statusElapsed = document.getElementById('statusElapsed');
  const statusRemaining = document.getElementById('statusRemaining');
  const statusCodec = document.getElementById('statusCodec');
  const statusChunks = document.getElementById('statusChunks');
  const progressBar = document.getElementById('progressBar');

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
      const maxDurationVal = parseInt(maxDurationSelect.value, 10);
      const warningThresholdVal = parseInt(warningThresholdInput.value, 10) || 5;

      chunkCounter = 0;
      statusChunks.textContent = '0';
      progressBar.style.width = '0%';
      progressBar.classList.remove('warning');

      activeSession = await window.ShowAndTell.startRecording({
        maxDuration: maxDurationVal > 0 ? maxDurationVal : undefined,
        warningThreshold: warningThresholdVal,
        audio: {
          mic: micAudioCheckbox.checked,
          system: systemAudioCheckbox.checked
        },
        ui: floatingUiCheckbox.checked,
        previewModal: previewModalCheckbox.checked,
        storage: storagePersistenceCheckbox.checked,
        uploadEndpoint: window.location.origin.includes('github.io') ? undefined : '/api/upload'
      });

      updateUiState('recording');
      statusCodec.textContent = window.ShowAndTell.getPreferredMimeType ? window.ShowAndTell.getPreferredMimeType() : 'Active';

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
      alert(`Error starting recording: ${err.message}`);
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
