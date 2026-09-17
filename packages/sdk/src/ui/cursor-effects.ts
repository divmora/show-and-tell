import { RecordingSession, CursorEffectsConfig } from '../types';

export interface CursorEffectsOptions extends CursorEffectsConfig {}

const DEFAULT_OPTIONS: Required<CursorEffectsConfig> = {
  clickRipple: true,
  rippleColor: '#3b82f6',
  rightClickRippleColor: '#f59e0b',
  rippleSize: 64,
  rippleDurationMs: 550,
  spotlight: false,
  spotlightRadius: 90,
  spotlightOpacity: 0.45,
  spotlightColor: 'rgba(0, 0, 0, 0.45)',
  spotlightRing: true
};

const CURSOR_EFFECTS_STYLES = `
:host {
  all: initial;
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none !important;
  z-index: 2147483646;
  overflow: hidden;
  margin: 0;
  padding: 0;
  display: block;
}

* {
  box-sizing: border-box;
}

.sat-spotlight-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: background, opacity;
}

.sat-spotlight-layer.is-active {
  opacity: 1;
}

.sat-ripple-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.sat-ripple {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  transform: translate(-50%, -50%) scale(0.15);
  animation: sat-ripple-pop var(--sat-dur, 550ms) cubic-bezier(0.1, 0.8, 0.25, 1) forwards;
  will-change: transform, opacity;
}

.sat-ripple-wave {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2.5px solid var(--sat-color, #3b82f6);
  box-shadow: 0 0 12px var(--sat-color, #3b82f6), inset 0 0 8px var(--sat-color, #3b82f6);
}

.sat-ripple-disc {
  position: absolute;
  inset: 15%;
  border-radius: 50%;
  background: radial-gradient(circle, var(--sat-color, #3b82f6) 0%, transparent 80%);
  opacity: 0.6;
}

@keyframes sat-ripple-pop {
  0% {
    transform: translate(-50%, -50%) scale(0.15);
    opacity: 0.95;
  }
  40% {
    opacity: 0.85;
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0;
  }
}
`;

export class CursorEffectsManager {
  private hostElement?: HTMLElement;
  private shadowRoot?: ShadowRoot;
  private spotlightLayer?: HTMLDivElement;
  private rippleLayer?: HTMLDivElement;
  private options: Required<CursorEffectsConfig>;
  private isSpotlightOn = false;
  private isPaused = false;
  private mouseX = -9999;
  private mouseY = -9999;
  private isPointerInside = false;
  private rafId?: number;
  private cleanupFns: Array<() => void> = [];

  constructor(
    private session?: RecordingSession,
    options: CursorEffectsConfig = {}
  ) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options
    };
    this.isSpotlightOn = this.options.spotlight;
  }

  mount(): void {
    if (typeof document === 'undefined') return;

    this.hostElement = document.createElement('show-and-tell-cursor-effects');
    this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = CURSOR_EFFECTS_STYLES;
    this.shadowRoot.appendChild(styleEl);

    // Spotlight background layer
    this.spotlightLayer = document.createElement('div');
    this.spotlightLayer.className = 'sat-spotlight-layer';
    this.shadowRoot.appendChild(this.spotlightLayer);

    // Ripple container layer
    this.rippleLayer = document.createElement('div');
    this.rippleLayer.className = 'sat-ripple-layer';
    this.shadowRoot.appendChild(this.rippleLayer);

    document.body.appendChild(this.hostElement);

    this.bindEvents();

    if (this.isSpotlightOn) {
      this.updateSpotlight();
    }
  }

  private bindEvents(): void {
    if (typeof window === 'undefined') return;

    // Pointer down / click detection
    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      if (this.isPaused) return;
      if (this.session && this.session.state !== 'recording') return;

      const x = e.clientX;
      const y = e.clientY;
      this.mouseX = x;
      this.mouseY = y;
      this.isPointerInside = true;

      if (this.options.clickRipple) {
        const color =
          e.button === 2
            ? this.options.rightClickRippleColor
            : this.options.rippleColor;
        this.triggerRipple(x, y, color);
      }

      if (this.isSpotlightOn) {
        this.scheduleSpotlightUpdate();
      }
    };

    // Pointer movement for spotlight tracking
    const handlePointerMove = (e: MouseEvent | PointerEvent) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.isPointerInside = true;

      if (this.isSpotlightOn && !this.isPaused) {
        this.scheduleSpotlightUpdate();
      }
    };

    const handleMouseLeave = () => {
      this.isPointerInside = false;
      if (this.isSpotlightOn) {
        this.scheduleSpotlightUpdate();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown, { capture: true, passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    this.cleanupFns.push(() => {
      window.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    });

    // Session lifecycle tracking
    if (this.session) {
      const offPause = this.session.on('pause', () => {
        this.isPaused = true;
        if (this.spotlightLayer) {
          this.spotlightLayer.classList.remove('is-active');
        }
      });

      const offResume = this.session.on('resume', () => {
        this.isPaused = false;
        if (this.isSpotlightOn && this.isPointerInside) {
          this.scheduleSpotlightUpdate();
        }
      });

      this.cleanupFns.push(offPause);
      this.cleanupFns.push(offResume);
    }
  }

  private scheduleSpotlightUpdate(): void {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = undefined;
      this.updateSpotlight();
    });
  }

  private updateSpotlight(): void {
    if (!this.spotlightLayer) return;

    if (!this.isSpotlightOn || this.isPaused || !this.isPointerInside) {
      this.spotlightLayer.classList.remove('is-active');
      return;
    }

    this.spotlightLayer.classList.add('is-active');

    const r = this.options.spotlightRadius;
    const opacity = this.options.spotlightOpacity;
    const x = this.mouseX;
    const y = this.mouseY;

    if (this.options.spotlightRing) {
      this.spotlightLayer.style.background =
        `radial-gradient(circle ${r}px at ${x}px ${y}px, ` +
        `transparent 0%, ` +
        `transparent ${Math.max(0, r - 5)}px, ` +
        `rgba(96, 165, 250, 0.7) ${Math.max(0, r - 2)}px, ` +
        `rgba(59, 130, 246, 0.3) ${r}px, ` +
        `rgba(0, 0, 0, ${opacity}) ${r + 6}px, ` +
        `rgba(0, 0, 0, ${opacity}) 100%)`;
    } else {
      this.spotlightLayer.style.background =
        `radial-gradient(circle ${r}px at ${x}px ${y}px, ` +
        `transparent 0%, ` +
        `transparent ${r}px, ` +
        `rgba(0, 0, 0, ${opacity}) ${r + 20}px, ` +
        `rgba(0, 0, 0, ${opacity}) 100%)`;
    }
  }

  triggerRipple(x: number, y: number, customColor?: string): void {
    if (!this.options.clickRipple || !this.rippleLayer || typeof document === 'undefined') return;

    const rippleEl = document.createElement('div');
    rippleEl.className = 'sat-ripple';
    const size = this.options.rippleSize;
    const dur = this.options.rippleDurationMs;
    const color = customColor || this.options.rippleColor;

    rippleEl.style.left = `${x}px`;
    rippleEl.style.top = `${y}px`;
    rippleEl.style.width = `${size}px`;
    rippleEl.style.height = `${size}px`;
    rippleEl.style.setProperty('--sat-color', color);
    rippleEl.style.setProperty('--sat-dur', `${dur}ms`);

    const wave = document.createElement('div');
    wave.className = 'sat-ripple-wave';
    const disc = document.createElement('div');
    disc.className = 'sat-ripple-disc';

    rippleEl.appendChild(wave);
    rippleEl.appendChild(disc);

    this.rippleLayer.appendChild(rippleEl);

    const removeRipple = () => {
      if (rippleEl.parentNode) {
        rippleEl.parentNode.removeChild(rippleEl);
      }
    };

    rippleEl.addEventListener('animationend', removeRipple, { once: true });
    setTimeout(removeRipple, dur + 100);
  }

  setSpotlight(enabled: boolean): void {
    this.isSpotlightOn = enabled;
    if (this.session) {
      // Trigger update
    }
    this.updateSpotlight();
  }

  toggleSpotlight(): boolean {
    this.setSpotlight(!this.isSpotlightOn);
    return this.isSpotlightOn;
  }

  isSpotlightActive(): boolean {
    return this.isSpotlightOn;
  }

  destroy(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
    }

    this.cleanupFns.forEach((fn) => {
      try {
        fn();
      } catch {
        // Ignore cleanup error
      }
    });
    this.cleanupFns = [];

    if (this.hostElement && this.hostElement.parentNode) {
      this.hostElement.parentNode.removeChild(this.hostElement);
    }
    this.hostElement = undefined;
    this.shadowRoot = undefined;
    this.spotlightLayer = undefined;
    this.rippleLayer = undefined;
  }
}
