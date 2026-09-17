import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PreviewModal } from './preview-modal';
import { RecordingResult } from '../types';

describe('PreviewModal Subsystem & Theming', () => {
  beforeEach(() => {
    document.querySelectorAll('show-and-tell-modal').forEach((el) => el.remove());
  });

  afterEach(() => {
    document.querySelectorAll('show-and-tell-modal').forEach((el) => el.remove());
    vi.restoreAllMocks();
  });

  const mockResult: RecordingResult = {
    id: 'test-rec-123',
    mode: 'pixel',
    blob: new Blob(['fake video'], { type: 'video/webm' }),
    url: 'blob:http://localhost/test',
    duration: 15,
    mimeType: 'video/webm',
    filename: 'test.webm',
    size: 1024,
    discontinueReason: 'user_stopped',
    download: vi.fn(),
    upload: vi.fn(),
    uploadPresigned: vi.fn(),
    revoke: vi.fn()
  };

  it('mounts into DOM and applies theme configuration', () => {
    const modal = new PreviewModal(mockResult, undefined, {
      mode: 'dark',
      primaryColor: '#ec4899',
      borderRadius: '12px'
    });
    modal.mount();

    const host = document.querySelector('show-and-tell-modal') as HTMLElement;
    expect(host).not.toBeNull();
    expect(host.getAttribute('data-theme')).toBe('dark');
    expect(host.style.getPropertyValue('--sat-primary')).toBe('#ec4899');
    expect(host.style.getPropertyValue('--sat-radius')).toBe('12px');

    const shadow = host.shadowRoot;
    expect(shadow).toBeDefined();
    expect(shadow?.querySelector('.sat-modal-dialog')).not.toBeNull();
    expect(shadow?.querySelector('.sat-modal-title')?.textContent).toContain('Recording Ready');
  });

  it('dynamically updates theme using setTheme()', () => {
    const modal = new PreviewModal(mockResult, undefined, { mode: 'dark' });
    modal.mount();

    const host = document.querySelector('show-and-tell-modal') as HTMLElement;
    expect(host.getAttribute('data-theme')).toBe('dark');

    modal.setTheme({
      mode: 'light',
      primaryColor: '#10b981'
    });

    expect(host.getAttribute('data-theme')).toBe('light');
    expect(host.classList.contains('sat-theme-light')).toBe(true);
    expect(host.style.getPropertyValue('--sat-primary')).toBe('#10b981');
  });

  it('toggles trimmer panel and adjusts cut handles in pixel mode', () => {
    const modal = new PreviewModal(mockResult);
    modal.mount();

    const host = document.querySelector('show-and-tell-modal') as HTMLElement;
    const shadow = host.shadowRoot!;

    const trimBtn = shadow.querySelector('#videoTrimBtn') as HTMLButtonElement;
    const trimPanel = shadow.querySelector('#videoTrimPanel') as HTMLElement;
    const handleIn = shadow.querySelector('#videoTrimHandleIn') as HTMLElement;
    const handleOut = shadow.querySelector('#videoTrimHandleOut') as HTMLElement;
    const activeDur = shadow.querySelector('#videoTrimActiveDur') as HTMLElement;
    const cutInfo = shadow.querySelector('#videoTrimCutInfo') as HTMLElement;
    const downloadFullBtn = shadow.querySelector('#satDownloadFullBtn') as HTMLButtonElement;
    const downloadBtnText = shadow.querySelector('#satDownloadBtnText') as HTMLElement;
    const resetBtn = shadow.querySelector('#videoTrimResetBtn') as HTMLButtonElement;

    expect(trimBtn).not.toBeNull();
    expect(trimPanel.style.display).toBe('none');
    expect(downloadFullBtn.style.display).toBe('none');

    // Toggle trim panel open
    trimBtn.click();
    expect(trimPanel.style.display).toBe('block');
    expect(trimBtn.classList.contains('is-active')).toBe(true);
    expect(trimBtn.textContent).toBe('✕ Close Trimmer');

    // Move In handle right by 2 seconds using keyboard arrow
    handleIn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    handleIn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));

    expect(activeDur.textContent).toBe('00:13');
    expect(cutInfo.textContent).toContain('00:02 removed');
    expect(downloadFullBtn.style.display).toBe('inline-flex');
    expect(downloadBtnText.textContent).toContain('Download Trimmed Video (00:13)');

    // Move Out handle left by 3 seconds
    handleOut.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    handleOut.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    handleOut.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));

    expect(activeDur.textContent).toBe('00:10');
    expect(cutInfo.textContent).toContain('00:05 removed');

    // Test mouse dragging on In handle
    const trimTrack = shadow.querySelector('#videoTrimTrack') as HTMLElement;
    vi.spyOn(trimTrack, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 20,
      right: 200,
      bottom: 20,
      x: 0,
      y: 0,
      toJSON: () => {}
    });

    handleIn.dispatchEvent(new MouseEvent('mousedown', { clientX: 0 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 40 })); // 40/200 = 20% = 3s
    window.dispatchEvent(new MouseEvent('mouseup', {}));

    expect(activeDur.textContent).toBe('00:09'); // out is 12, in is 3 => 12 - 3 = 9

    // Test track click
    trimTrack.dispatchEvent(new MouseEvent('click', { clientX: 180 })); // 180/200 = 90% = 13.5s => closer to out (12s) => sets out to 13.5s
    expect(activeDur.textContent).toBe('00:11'); // 13.5 - 3 = 10.5 => rounds to 11

    // Click Reset
    resetBtn.click();
    expect(activeDur.textContent).toBe('00:15');
    expect(cutInfo.textContent).toBe('Full Duration (No Cuts)');
    expect(downloadFullBtn.style.display).toBe('none');
    expect(downloadBtnText.textContent).toBe('Download Video');

    modal.destroy();
  });

  it('triggers trimmed export and untrimmed full download in DOM mode', async () => {
    const mockDomResult: RecordingResult = {
      id: 'test-dom-rec-123',
      mode: 'dom',
      blob: new Blob([JSON.stringify({ events: [] })], { type: 'application/json' }),
      url: 'blob:http://localhost/test-dom',
      duration: 30,
      mimeType: 'application/json',
      filename: 'test.html',
      size: 2048,
      discontinueReason: 'user_stopped',
      domEvents: [
        {
          type: 'dom_snapshot',
          timestamp: 0,
          snapshot: { id: 1, type: 1, name: 'html', children: [] },
          viewport: { width: 1280, height: 800, scrollX: 0, scrollY: 0 }
        },
        {
          type: 'mouse_move',
          timestamp: 10000,
          x: 100,
          y: 100
        },
        {
          type: 'mouse_move',
          timestamp: 25000,
          x: 200,
          y: 200
        }
      ],
      download: vi.fn(),
      downloadJson: vi.fn(),
      downloadHtmlReplay: vi.fn(),
      upload: vi.fn(),
      uploadPresigned: vi.fn(),
      revoke: vi.fn()
    };

    const modal = new PreviewModal(mockDomResult);
    modal.mount();

    const host = document.querySelector('show-and-tell-modal') as HTMLElement;
    const shadow = host.shadowRoot!;

    const trimBtn = shadow.querySelector('#domTrimBtn') as HTMLButtonElement;
    const handleIn = shadow.querySelector('#domTrimHandleIn') as HTMLElement;
    const downloadBtn = shadow.querySelector('.sat-btn-download') as HTMLButtonElement;
    const downloadFullBtn = shadow.querySelector('#satDownloadFullBtn') as HTMLButtonElement;
    const previewBtn = shadow.querySelector('#domTrimPreviewBtn') as HTMLButtonElement;

    // Toggle trim open and adjust in handle
    trimBtn.click();
    handleIn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })); // +1s
    handleIn.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })); // +2s

    expect(downloadFullBtn.style.display).toBe('inline-flex');

    // Clicking preview cut should start playback
    expect(() => previewBtn.click()).not.toThrow();

    // Download full untrimmed
    downloadFullBtn.click();
    expect(mockDomResult.downloadHtmlReplay).toHaveBeenCalledTimes(1);

    // Download trimmed replay
    downloadBtn.click();
    // Wait microtask for async trim & download
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(downloadBtn.disabled).toBe(false);

    modal.destroy();
  });

  it('renders Network Inspector drawer with method badges, status pills, and Export HAR button', () => {
    const mockNetResult: RecordingResult = {
      blob: new Blob(['video-bits'], { type: 'video/webm' }),
      url: 'blob:http://localhost/video-123',
      duration: 10,
      size: 1024,
      mimeType: 'video/webm',
      download: vi.fn(),
      diagnostics: [
        {
          id: 'diag_net_1',
          category: 'network',
          level: 'error',
          timestamp: 2500,
          timestampMs: 2500,
          message: 'POST /api/checkout (500 Error)',
          method: 'POST',
          url: 'https://api.example.com/checkout',
          status: 500,
          statusText: 'Internal Server Error',
          durationMs: 120,
          requestHeaders: { 'Content-Type': 'application/json', 'Authorization': 'Bearer [REDACTED]' },
          responseHeaders: { 'Content-Type': 'application/json' },
          requestBody: { orderId: '123' },
          responseBody: { error: 'PaymentFailed' },
          initiatorType: 'fetch'
        }
      ]
    };

    const modal = new PreviewModal(mockNetResult);
    modal.mount();

    const host = document.querySelector('show-and-tell-modal') as HTMLElement;
    const shadow = host.shadowRoot!;

    const exportHarBtn = shadow.querySelector('#diagExportHarBtn') as HTMLButtonElement;
    expect(exportHarBtn).not.toBeNull();

    const netRow = shadow.querySelector('.sat-diag-item') as HTMLElement;
    expect(netRow).not.toBeNull();
    expect(netRow.innerHTML).toContain('POST');
    expect(netRow.innerHTML).toContain('500');

    // Click network row to open inspector
    netRow.click();

    const inspector = shadow.querySelector('#netInspectorContainer') as HTMLElement;
    expect(inspector.style.display).toBe('block');
    expect(inspector.innerHTML).toContain('Authorization');
    expect(inspector.innerHTML).toContain('REDACTED');
    expect(inspector.innerHTML).toContain('cURL');

    modal.destroy();
  });
});

