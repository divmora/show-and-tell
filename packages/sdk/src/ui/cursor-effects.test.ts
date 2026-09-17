import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CursorEffectsManager } from './cursor-effects';
import { EventEmitter } from '../utils/event-emitter';

function createMockSession() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    state: 'recording' as any,
    id: 'test-session',
    getStats: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    muteMic: vi.fn(),
    unmuteMic: vi.fn(),
    toggleMic: vi.fn(),
    isMicMuted: vi.fn(),
    toggleSpotlight: vi.fn(),
    setSpotlight: vi.fn(),
    isSpotlightActive: vi.fn(),
    triggerClickRipple: vi.fn(),
    on: emitter.on.bind(emitter),
    off: emitter.off.bind(emitter)
  });
}

describe('CursorEffectsManager', () => {
  let manager: CursorEffectsManager;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('mounts into DOM with isolated shadow root and expected layers', () => {
    const session = createMockSession();
    manager = new CursorEffectsManager(session, {
      clickRipple: true,
      spotlight: false
    });

    manager.mount();

    const host = document.querySelector('show-and-tell-cursor-effects');
    expect(host).not.toBeNull();
    expect(host?.shadowRoot).toBeDefined();

    const spotlightLayer = host?.shadowRoot?.querySelector('.sat-spotlight-layer');
    const rippleLayer = host?.shadowRoot?.querySelector('.sat-ripple-layer');

    expect(spotlightLayer).not.toBeNull();
    expect(rippleLayer).not.toBeNull();
  });

  it('generates ripple element on pointerdown with coordinates and default color', () => {
    const session = createMockSession();
    manager = new CursorEffectsManager(session, {
      clickRipple: true,
      rippleColor: '#3b82f6'
    });
    manager.mount();

    const host = document.querySelector('show-and-tell-cursor-effects');
    const rippleLayer = host?.shadowRoot?.querySelector('.sat-ripple-layer');

    expect(rippleLayer?.children.length).toBe(0);

    const event = new MouseEvent('pointerdown', {
      clientX: 150,
      clientY: 250,
      button: 0,
      bubbles: true
    });
    window.dispatchEvent(event);

    expect(rippleLayer?.children.length).toBe(1);
    const ripple = rippleLayer?.firstElementChild as HTMLElement;
    expect(ripple.classList.contains('sat-ripple')).toBe(true);
    expect(ripple.style.left).toBe('150px');
    expect(ripple.style.top).toBe('250px');
    expect(ripple.style.getPropertyValue('--sat-color')).toBe('#3b82f6');
  });

  it('applies rightClickRippleColor on right-click (button 2)', () => {
    const session = createMockSession();
    manager = new CursorEffectsManager(session, {
      clickRipple: true,
      rightClickRippleColor: '#f59e0b'
    });
    manager.mount();

    const host = document.querySelector('show-and-tell-cursor-effects');
    const rippleLayer = host?.shadowRoot?.querySelector('.sat-ripple-layer');

    const rightClickEvent = new MouseEvent('pointerdown', {
      clientX: 200,
      clientY: 300,
      button: 2,
      bubbles: true
    });
    window.dispatchEvent(rightClickEvent);

    const ripple = rippleLayer?.firstElementChild as HTMLElement;
    expect(ripple.style.getPropertyValue('--sat-color')).toBe('#f59e0b');
  });

  it('supports programmatic triggerRipple with custom colors', () => {
    const session = createMockSession();
    manager = new CursorEffectsManager(session);
    manager.mount();

    const host = document.querySelector('show-and-tell-cursor-effects');
    const rippleLayer = host?.shadowRoot?.querySelector('.sat-ripple-layer');

    manager.triggerRipple(400, 500, '#10b981');

    expect(rippleLayer?.children.length).toBe(1);
    const ripple = rippleLayer?.firstElementChild as HTMLElement;
    expect(ripple.style.left).toBe('400px');
    expect(ripple.style.top).toBe('500px');
    expect(ripple.style.getPropertyValue('--sat-color')).toBe('#10b981');
  });

  it('ignores clicks when session is paused', () => {
    const session = createMockSession();
    manager = new CursorEffectsManager(session);
    manager.mount();

    const host = document.querySelector('show-and-tell-cursor-effects');
    const rippleLayer = host?.shadowRoot?.querySelector('.sat-ripple-layer');

    // Emit pause on session
    session.emit('pause');

    const event = new MouseEvent('pointerdown', {
      clientX: 100,
      clientY: 100,
      button: 0,
      bubbles: true
    });
    window.dispatchEvent(event);

    expect(rippleLayer?.children.length).toBe(0);
  });

  it('toggles spotlight and updates active state and background gradient', () => {
    const session = createMockSession();
    manager = new CursorEffectsManager(session, {
      spotlight: false,
      spotlightRadius: 100
    });
    manager.mount();

    const host = document.querySelector('show-and-tell-cursor-effects');
    const spotlightLayer = host?.shadowRoot?.querySelector('.sat-spotlight-layer') as HTMLElement;

    expect(manager.isSpotlightActive()).toBe(false);
    expect(spotlightLayer.classList.contains('is-active')).toBe(false);

    // Toggle on
    const newState = manager.toggleSpotlight();
    expect(newState).toBe(true);
    expect(manager.isSpotlightActive()).toBe(true);

    // Simulate mouse movement
    const moveEvent = new MouseEvent('pointermove', {
      clientX: 300,
      clientY: 400
    });
    window.dispatchEvent(moveEvent);

    // Advance animation frame
    vi.runAllTimers();

    expect(spotlightLayer.classList.contains('is-active')).toBe(true);
    expect(spotlightLayer.style.background).toContain('circle 100px at 300px 400px');

    // Toggle off
    manager.setSpotlight(false);
    expect(manager.isSpotlightActive()).toBe(false);
    expect(spotlightLayer.classList.contains('is-active')).toBe(false);
  });

  it('cleans up completely on destroy', () => {
    const session = createMockSession();
    manager = new CursorEffectsManager(session);
    manager.mount();

    expect(document.querySelector('show-and-tell-cursor-effects')).not.toBeNull();

    manager.destroy();

    expect(document.querySelector('show-and-tell-cursor-effects')).toBeNull();
  });
});
