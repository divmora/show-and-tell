import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecordingWidget } from './widget';
import { EventEmitter } from '../utils/event-emitter';

function createMockSession() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    state: 'recording' as any,
    id: 'test-session',
    getStats: vi.fn(() => ({
      elapsedMs: 5000,
      formattedElapsed: '00:05',
      isWarning: false
    })),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    muteMic: vi.fn(),
    unmuteMic: vi.fn(),
    toggleMic: vi.fn(() => true), // returns isMuted
    isMicMuted: vi.fn(() => false),
    toggleSpotlight: vi.fn(() => false),
    setSpotlight: vi.fn(),
    isSpotlightActive: vi.fn(() => false),
    triggerClickRipple: vi.fn(),
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter)
  });
}

describe('RecordingWidget Audio Meter & VU Meter', () => {
  beforeEach(() => {
    document.querySelectorAll('show-and-tell-widget').forEach((el) => el.remove());
  });

  afterEach(() => {
    document.querySelectorAll('show-and-tell-widget').forEach((el) => el.remove());
    vi.restoreAllMocks();
  });

  it('renders 3-segment VU meter and silent warning container when hasMic: true', () => {
    const session = createMockSession();
    const widget = new RecordingWidget(session as any, true);
    widget.mount();

    const host = document.querySelector('show-and-tell-widget');
    expect(host).not.toBeNull();
    expect(host?.shadowRoot).toBeDefined();

    const micBtn = host?.shadowRoot?.querySelector('.sat-btn-mic');
    const vuMeter = host?.shadowRoot?.querySelector('.sat-vu-meter');
    const silentWarning = host?.shadowRoot?.querySelector('.sat-silent-warning') as HTMLElement;
    const bars = host?.shadowRoot?.querySelectorAll('.sat-vu-bar');

    expect(micBtn).not.toBeNull();
    expect(vuMeter).not.toBeNull();
    expect(silentWarning).not.toBeNull();
    expect(silentWarning.style.display).toBe('none');
    expect(bars?.length).toBe(3);

    widget.destroy();
  });

  it('does not render mic button or VU meter when hasMic: false', () => {
    const session = createMockSession();
    const widget = new RecordingWidget(session as any, false);
    widget.mount();

    const host = document.querySelector('show-and-tell-widget');
    const micBtn = host?.shadowRoot?.querySelector('.sat-btn-mic');
    const vuMeter = host?.shadowRoot?.querySelector('.sat-vu-meter');

    expect(micBtn).toBeNull();
    expect(vuMeter).toBeNull();

    widget.destroy();
  });

  it('updates data-level attribute on VU meter when audioLevel event fires', () => {
    const session = createMockSession();
    const widget = new RecordingWidget(session as any, true);
    widget.mount();

    const host = document.querySelector('show-and-tell-widget');
    const vuMeter = host?.shadowRoot?.querySelector('.sat-vu-meter');

    expect(vuMeter?.getAttribute('data-level')).toBe('0');

    // Emit level 1 (low)
    session.emit('audioLevel', { volume: 0.1, level: 1 });
    expect(vuMeter?.getAttribute('data-level')).toBe('1');

    // Emit level 2 (medium)
    session.emit('audioLevel', { volume: 0.35, level: 2 });
    expect(vuMeter?.getAttribute('data-level')).toBe('2');

    // Emit level 3 (peak)
    session.emit('audioLevel', { volume: 0.8, level: 3 });
    expect(vuMeter?.getAttribute('data-level')).toBe('3');

    widget.destroy();
  });

  it('displays silent mic warning alert when silentMicWarning event is true and hides when false', () => {
    const session = createMockSession();
    const widget = new RecordingWidget(session as any, true);
    widget.mount();

    const host = document.querySelector('show-and-tell-widget');
    const silentWarning = host?.shadowRoot?.querySelector('.sat-silent-warning') as HTMLElement;
    expect(silentWarning.style.display).toBe('none');

    // Trigger silent mic warning
    session.emit('silentMicWarning', true);
    expect(silentWarning.style.display).toBe('inline-flex');

    // Sound detected / dismissed
    session.emit('silentMicWarning', false);
    expect(silentWarning.style.display).toBe('none');

    widget.destroy();
  });

  it('sets is-muted class and zeroes level when mic is muted', () => {
    const session = createMockSession();
    const widget = new RecordingWidget(session as any, true);
    widget.mount();

    const host = document.querySelector('show-and-tell-widget');
    const micBtn = host?.shadowRoot?.querySelector('.sat-btn-mic') as HTMLButtonElement;
    const vuMeter = host?.shadowRoot?.querySelector('.sat-vu-meter');
    const silentWarning = host?.shadowRoot?.querySelector('.sat-silent-warning') as HTMLElement;

    // First simulate level 2 and warning active
    session.emit('audioLevel', { volume: 0.4, level: 2 });
    session.emit('silentMicWarning', true);

    // User clicks mic button to mute
    micBtn.click();
    expect(session.toggleMic).toHaveBeenCalled();
    expect(vuMeter?.classList.contains('is-muted')).toBe(true);
    expect(vuMeter?.getAttribute('data-level')).toBe('0');
    expect(silentWarning.style.display).toBe('none');

    widget.destroy();
  });
});
