import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CountdownOverlay } from './countdown';

describe('CountdownOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Clean up any remaining countdown elements from DOM
    document.querySelectorAll('show-and-tell-countdown').forEach((el) => el.remove());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.querySelectorAll('show-and-tell-countdown').forEach((el) => el.remove());
  });

  it('mounts into DOM with isolated shadow root and default markup', async () => {
    const promise = CountdownOverlay.show({ seconds: 3 });

    const host = document.querySelector('show-and-tell-countdown');
    expect(host).not.toBeNull();
    expect(host?.shadowRoot).toBeDefined();

    const card = host?.shadowRoot?.querySelector('.sat-countdown-card');
    const label = host?.shadowRoot?.querySelector('.sat-countdown-label');
    const numberEl = host?.shadowRoot?.querySelector('.sat-countdown-number');
    const skipBtn = host?.shadowRoot?.querySelector('.sat-btn-skip');
    const cancelBtn = host?.shadowRoot?.querySelector('.sat-btn-cancel');

    expect(card).not.toBeNull();
    expect(label?.textContent?.trim()).toBe('Recording starts in...');
    expect(numberEl?.textContent?.trim()).toBe('3');
    expect(skipBtn).not.toBeNull();
    expect(cancelBtn).not.toBeNull();

    // Fast-forward to finish
    await vi.advanceTimersByTimeAsync(4000);
    const result = await promise;
    expect(result).toBe(true);
    expect(document.querySelector('show-and-tell-countdown')).toBeNull();
  });

  it('respects custom label and custom countdown seconds', async () => {
    const onTick = vi.fn();
    const promise = CountdownOverlay.show({
      seconds: 5,
      label: 'Get ready in...',
      onTick
    });

    const host = document.querySelector('show-and-tell-countdown');
    const label = host?.shadowRoot?.querySelector('.sat-countdown-label');
    const numberEl = host?.shadowRoot?.querySelector('.sat-countdown-number');

    expect(label?.textContent?.trim()).toBe('Get ready in...');
    expect(numberEl?.textContent?.trim()).toBe('5');
    expect(onTick).toHaveBeenCalledWith(5);

    // Advance 1 second
    await vi.advanceTimersByTimeAsync(1000);
    expect(numberEl?.textContent?.trim()).toBe('4');
    expect(onTick).toHaveBeenCalledWith(4);

    // Advance remaining seconds to Go! (4 -> 3 -> 2 -> 1 -> 0/Go!)
    await vi.advanceTimersByTimeAsync(4000);
    expect(numberEl?.textContent?.trim()).toBe('Go!');
    expect(numberEl?.classList.contains('is-go')).toBe(true);

    // Advance through the post-Go delay (350ms)
    await vi.advanceTimersByTimeAsync(500);
    const result = await promise;
    expect(result).toBe(true);
    expect(document.querySelector('show-and-tell-countdown')).toBeNull();
  });

  it('resolves true immediately when Start Now button is clicked', async () => {
    const promise = CountdownOverlay.show({ seconds: 10 });

    const host = document.querySelector('show-and-tell-countdown');
    const skipBtn = host?.shadowRoot?.querySelector('.sat-btn-skip') as HTMLButtonElement;
    expect(skipBtn).not.toBeNull();

    // User clicks "Start Now" before countdown reaches 0
    skipBtn.click();

    const result = await promise;
    expect(result).toBe(true);
    expect(document.querySelector('show-and-tell-countdown')).toBeNull();
  });

  it('resolves false immediately when Cancel button is clicked', async () => {
    const promise = CountdownOverlay.show({ seconds: 5 });

    const host = document.querySelector('show-and-tell-countdown');
    const cancelBtn = host?.shadowRoot?.querySelector('.sat-btn-cancel') as HTMLButtonElement;
    expect(cancelBtn).not.toBeNull();

    // User clicks "Cancel"
    cancelBtn.click();

    const result = await promise;
    expect(result).toBe(false);
    expect(document.querySelector('show-and-tell-countdown')).toBeNull();
  });

  it('safely handles destroy() and prevents multiple resolutions or memory leaks', () => {
    const overlay = new CountdownOverlay({ seconds: 3 });
    (overlay as any).mount();

    expect(document.querySelector('show-and-tell-countdown')).not.toBeNull();

    overlay.destroy();
    expect(document.querySelector('show-and-tell-countdown')).toBeNull();

    // Subsequent call should be no-op and not throw
    expect(() => overlay.destroy()).not.toThrow();
  });

  it('handles audio enabled without throwing even if AudioContext is unavailable or throws', async () => {
    // Mock window.AudioContext throwing error
    const origAudioContext = (window as any).AudioContext;
    (window as any).AudioContext = vi.fn().mockImplementation(() => {
      throw new Error('Not allowed to start audio');
    });

    try {
      const promise = CountdownOverlay.show({ seconds: 2, audio: true });
      await vi.advanceTimersByTimeAsync(3000);
      const result = await promise;
      expect(result).toBe(true);
    } finally {
      (window as any).AudioContext = origAudioContext;
    }
  });

  it('does not invoke AudioContext when audio: false', async () => {
    const mockAudioContext = vi.fn();
    const origAudioContext = (window as any).AudioContext;
    (window as any).AudioContext = mockAudioContext;

    try {
      const promise = CountdownOverlay.show({ seconds: 2, audio: false });
      await vi.advanceTimersByTimeAsync(3000);
      const result = await promise;
      expect(result).toBe(true);
      expect(mockAudioContext).not.toHaveBeenCalled();
    } finally {
      (window as any).AudioContext = origAudioContext;
    }
  });
});
