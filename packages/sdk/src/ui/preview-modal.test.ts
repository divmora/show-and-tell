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
});
