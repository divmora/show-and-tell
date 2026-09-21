import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TelestratorOverlay, DEFAULT_PALETTE_COLORS } from './telestrator';

describe('TelestratorOverlay', () => {
  let telestrator: TelestratorOverlay;

  beforeEach(() => {
    document.body.innerHTML = '';
    // Mock canvas getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      setTransform: vi.fn(),
      scale: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      closePath: vi.fn(),
      globalAlpha: 1,
      strokeStyle: '#000000',
      fillStyle: '#000000',
      lineWidth: 1,
      lineCap: 'round',
      lineJoin: 'round'
    }) as any;
  });

  afterEach(() => {
    telestrator?.destroy();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('mounts into DOM with isolated shadow root and default configuration', () => {
    telestrator = new TelestratorOverlay();
    telestrator.mount();

    const host = document.querySelector('show-and-tell-telestrator');
    expect(host).toBeTruthy();
    expect(host?.shadowRoot).toBeTruthy();

    const canvas = host?.shadowRoot?.querySelector('canvas.sat-canvas');
    expect(canvas).toBeTruthy();

    const palette = host?.shadowRoot?.querySelector('.sat-palette');
    expect(palette).toBeTruthy();
    expect(palette?.classList.contains('is-hidden')).toBe(true);
  });

  it('toggles active state and updates canvas and palette visibility', () => {
    telestrator = new TelestratorOverlay();
    telestrator.mount();

    const onToggle = vi.fn();
    telestrator.onToggle = onToggle;

    expect(telestrator.getIsActive()).toBe(false);

    const activeState = telestrator.toggle();
    expect(activeState).toBe(true);
    expect(telestrator.getIsActive()).toBe(true);
    expect(onToggle).toHaveBeenCalledWith(true);

    const host = document.querySelector('show-and-tell-telestrator');
    const canvas = host?.shadowRoot?.querySelector('canvas.sat-canvas');
    const palette = host?.shadowRoot?.querySelector('.sat-palette');

    expect(canvas?.classList.contains('is-active')).toBe(true);
    expect(palette?.classList.contains('is-hidden')).toBe(false);

    // Toggle off
    telestrator.toggle();
    expect(telestrator.getIsActive()).toBe(false);
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(canvas?.classList.contains('is-active')).toBe(false);
    expect(palette?.classList.contains('is-hidden')).toBe(true);
  });

  it('allows selecting tools and updates palette UI', () => {
    telestrator = new TelestratorOverlay({ defaultTool: 'pen' });
    telestrator.mount();

    expect(telestrator.getTool()).toBe('pen');

    telestrator.setTool('arrow');
    expect(telestrator.getTool()).toBe('arrow');

    const host = document.querySelector('show-and-tell-telestrator');
    const penBtn = host?.shadowRoot?.querySelector('.sat-btn-pen');
    const arrowBtn = host?.shadowRoot?.querySelector('.sat-btn-arrow');

    expect(penBtn?.classList.contains('is-selected')).toBe(false);
    expect(arrowBtn?.classList.contains('is-selected')).toBe(true);
  });

  it('allows selecting colors and updates color swatches', () => {
    telestrator = new TelestratorOverlay();
    telestrator.mount();

    expect(telestrator.getColor()).toBe('#ef4444');

    telestrator.setColor('#3b82f6');
    expect(telestrator.getColor()).toBe('#3b82f6');

    const host = document.querySelector('show-and-tell-telestrator');
    const blueSwatch = host?.shadowRoot?.querySelector('.sat-color-swatch[data-color="#3b82f6"]');
    const redSwatch = host?.shadowRoot?.querySelector('.sat-color-swatch[data-color="#ef4444"]');

    expect(blueSwatch?.classList.contains('is-selected')).toBe(true);
    expect(redSwatch?.classList.contains('is-selected')).toBe(false);
  });

  it('toggles disappearing ink mode', () => {
    telestrator = new TelestratorOverlay({ disappearingInk: false });
    telestrator.mount();

    expect(telestrator.getDisappearingInk()).toBe(false);

    const newState = telestrator.toggleDisappearingInk();
    expect(newState).toBe(true);
    expect(telestrator.getDisappearingInk()).toBe(true);

    const host = document.querySelector('show-and-tell-telestrator');
    const fadeBtn = host?.shadowRoot?.querySelector('.sat-btn-fade');
    expect(fadeBtn?.classList.contains('is-active-toggle')).toBe(true);
  });

  it('captures freehand pen drawings and emits onDraw event', () => {
    telestrator = new TelestratorOverlay();
    telestrator.mount();

    const onDraw = vi.fn();
    telestrator.onDraw = onDraw;

    telestrator.setActive(true);

    const host = document.querySelector('show-and-tell-telestrator');
    const canvas = host?.shadowRoot?.querySelector('canvas.sat-canvas') as HTMLCanvasElement;

    // Simulate drawing stroke
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 100, button: 0 }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 110, clientY: 115, button: 0 }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 120, clientY: 130, button: 0 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: 120, clientY: 130, button: 0 }));

    expect(onDraw).toHaveBeenCalledTimes(1);
    const event = onDraw.mock.calls[0][0];
    expect(event.action).toBe('draw');
    expect(event.tool).toBe('pen');
    expect(event.points.length).toBe(3);
    expect(event.points[0]).toEqual({ x: 100, y: 100 });
    expect(event.points[1]).toEqual({ x: 110, y: 115 });
    expect(event.points[2]).toEqual({ x: 120, y: 130 });
    expect(event.color).toBe('#ef4444');
    expect(event.strokeWidth).toBe(4);

    expect(telestrator.getActiveStrokes().length).toBe(1);
  });

  it('captures vector arrow drawing and emits onDraw event', () => {
    telestrator = new TelestratorOverlay();
    telestrator.mount();

    const onDraw = vi.fn();
    telestrator.onDraw = onDraw;

    telestrator.setActive(true);
    telestrator.setTool('arrow');
    telestrator.setColor('#10b981');

    const host = document.querySelector('show-and-tell-telestrator');
    const canvas = host?.shadowRoot?.querySelector('canvas.sat-canvas') as HTMLCanvasElement;

    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 50, clientY: 50, button: 0 }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, clientY: 250, button: 0 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: 200, clientY: 250, button: 0 }));

    expect(onDraw).toHaveBeenCalledTimes(1);
    const event = onDraw.mock.calls[0][0];
    expect(event.action).toBe('draw');
    expect(event.tool).toBe('arrow');
    expect(event.points).toEqual([
      { x: 50, y: 50 },
      { x: 200, y: 250 }
    ]);
    expect(event.color).toBe('#10b981');
    expect(telestrator.getActiveStrokes().length).toBe(1);
  });

  it('clears drawings and notifies listener on clear()', () => {
    telestrator = new TelestratorOverlay();
    telestrator.mount();

    const onDraw = vi.fn();
    telestrator.onDraw = onDraw;

    telestrator.setActive(true);
    const host = document.querySelector('show-and-tell-telestrator');
    const canvas = host?.shadowRoot?.querySelector('canvas.sat-canvas') as HTMLCanvasElement;

    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 0 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: 10, clientY: 10, button: 0 }));

    expect(telestrator.getActiveStrokes().length).toBe(1);

    telestrator.clear();
    expect(telestrator.getActiveStrokes().length).toBe(0);
    expect(onDraw).toHaveBeenLastCalledWith({ action: 'clear' });
  });

  it('properly cleans up on destroy()', () => {
    telestrator = new TelestratorOverlay();
    telestrator.mount();

    const host = document.querySelector('show-and-tell-telestrator');
    expect(host).toBeTruthy();

    telestrator.destroy();
    expect(document.querySelector('show-and-tell-telestrator')).toBeNull();
  });
});
