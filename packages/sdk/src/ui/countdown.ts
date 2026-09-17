import { CountdownConfig, ThemeConfig } from '../types';
import { applyThemeToHost } from './theme';

export interface CountdownOptions extends CountdownConfig {
  onTick?: (remaining: number) => void;
  theme?: ThemeConfig;
}

const COUNTDOWN_STYLES = `
:host {
  all: initial;
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  font-family: var(--sat-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
  color: var(--sat-text, #ffffff);
  user-select: none;
  cursor: default;
  animation: sat-countdown-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

* {
  box-sizing: border-box;
}

@keyframes sat-countdown-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.sat-countdown-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  background: var(--sat-bg, rgba(24, 24, 27, 0.85));
  border: 1px solid var(--sat-border, rgba(255, 255, 255, 0.15));
  border-radius: var(--sat-radius-lg, 28px);
  padding: 36px 44px;
  box-shadow: var(--sat-shadow, 0 25px 50px -12px rgba(0, 0, 0, 0.6));
  text-align: center;
}

.sat-countdown-label {
  font-size: 15px;
  font-weight: 500;
  color: var(--sat-text-muted, #94a3b8);
  letter-spacing: 0.3px;
}

.sat-countdown-circle-wrap {
  position: relative;
  width: 140px;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sat-countdown-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.sat-countdown-track {
  fill: none;
  stroke: rgba(255, 255, 255, 0.1);
  stroke-width: 6;
}

.sat-countdown-progress {
  fill: none;
  stroke: var(--sat-primary, #3b82f6);
  stroke-width: 6;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.95s linear, stroke 0.2s ease;
}

.sat-countdown-number {
  font-size: 64px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--sat-text, #ffffff);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: sat-number-pulse 0.9s cubic-bezier(0.15, 0.85, 0.35, 1);
  will-change: transform, opacity;
}

.sat-countdown-number.is-go {
  font-size: 46px;
  color: var(--sat-success, #34d399);
  text-shadow: 0 0 24px rgba(52, 211, 153, 0.5);
}

@keyframes sat-number-pulse {
  0% {
    transform: scale(0.65);
    opacity: 0.3;
  }
  50% {
    transform: scale(1.08);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.sat-countdown-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
}

.sat-btn-skip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--sat-primary, #3b82f6);
  color: var(--sat-primary-contrast, #ffffff);
  border: none;
  border-radius: var(--sat-radius-full, 9999px);
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  outline: none;
}

.sat-btn-skip:hover {
  background: var(--sat-primary-hover, #2563eb);
  transform: translateY(-1px);
}

.sat-btn-skip:active {
  transform: translateY(0);
}

.sat-btn-cancel {
  display: inline-flex;
  align-items: center;
  background: var(--sat-btn-bg, rgba(255, 255, 255, 0.08));
  color: var(--sat-text-secondary, #cbd5e1);
  border: 1px solid var(--sat-btn-border, rgba(255, 255, 255, 0.12));
  border-radius: var(--sat-radius-full, 9999px);
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  outline: none;
}

.sat-btn-cancel:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
  transform: translateY(-1px);
}

.sat-btn-cancel:active {
  transform: translateY(0);
}
`;

function playTickSound(isFinal: boolean = false): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (isFinal) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    }

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 250);
  } catch {
    // AudioContext blocked by browser autoplay policy or test environment
  }
}

export class CountdownOverlay {
  private hostElement?: HTMLElement;
  private shadowRoot?: ShadowRoot;
  private numberEl?: HTMLElement;
  private progressEl?: SVGCircleElement;
  private timerId?: any;
  private remaining: number;
  private totalSeconds: number;
  private isDestroyed = false;
  private resolvePromise?: (proceed: boolean) => void;

  constructor(private options: CountdownOptions = {}) {
    this.totalSeconds = Math.max(1, options.seconds ?? 3);
    this.remaining = this.totalSeconds;
  }

  /**
   * Displays the countdown overlay and returns a promise resolving true when ready to record,
   * or false if user clicks Cancel.
   */
  static show(options: CountdownOptions = {}): Promise<boolean> {
    if (typeof document === 'undefined') {
      return Promise.resolve(true);
    }
    const overlay = new CountdownOverlay(options);
    return overlay.start();
  }

  private start(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.resolvePromise = resolve;
      this.mount();
      this.tick();
    });
  }

  private mount(): void {
    this.hostElement = document.createElement('show-and-tell-countdown');
    applyThemeToHost(this.hostElement, this.options.theme);
    this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = COUNTDOWN_STYLES;
    this.shadowRoot.appendChild(styleEl);

    const radius = 56;
    const circumference = 2 * Math.PI * radius;

    const card = document.createElement('div');
    card.className = 'sat-countdown-card';
    card.innerHTML = `
      <div class="sat-countdown-label">
        ${this.options.label || 'Recording starts in...'}
      </div>
      <div class="sat-countdown-circle-wrap">
        <svg class="sat-countdown-svg" viewBox="0 0 140 140">
          <circle class="sat-countdown-track" cx="70" cy="70" r="${radius}"></circle>
          <circle 
            class="sat-countdown-progress" 
            cx="70" 
            cy="70" 
            r="${radius}" 
            stroke-dasharray="${circumference}" 
            stroke-dashoffset="0">
          </circle>
        </svg>
        <div class="sat-countdown-number">${this.remaining}</div>
      </div>
      <div class="sat-countdown-actions">
        <button type="button" class="sat-btn-cancel">Cancel</button>
        <button type="button" class="sat-btn-skip">Start Now &rarr;</button>
      </div>
    `;

    this.shadowRoot.appendChild(card);
    document.body.appendChild(this.hostElement);

    this.numberEl = card.querySelector('.sat-countdown-number') as HTMLElement;
    this.progressEl = card.querySelector('.sat-countdown-progress') as SVGCircleElement;

    const skipBtn = card.querySelector('.sat-btn-skip') as HTMLButtonElement;
    const cancelBtn = card.querySelector('.sat-btn-cancel') as HTMLButtonElement;

    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.finish(true);
    });

    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.finish(false);
    });
  }

  private tick(): void {
    if (this.isDestroyed) return;

    const radius = 56;
    const circumference = 2 * Math.PI * radius;

    if (this.remaining > 0) {
      if (this.numberEl) {
        this.numberEl.textContent = String(this.remaining);
        // Retrigger CSS animation
        this.numberEl.style.animation = 'none';
        void this.numberEl.offsetHeight;
        this.numberEl.style.animation = '';
      }

      if (this.progressEl) {
        const offset = circumference * (1 - (this.remaining - 1) / this.totalSeconds);
        this.progressEl.style.strokeDashoffset = `${offset}`;
      }

      if (this.options.audio !== false) {
        playTickSound(false);
      }

      this.options.onTick?.(this.remaining);
      this.remaining -= 1;

      this.timerId = setTimeout(() => {
        this.tick();
      }, 1000);
    } else {
      // Reached 0: Show "Go!"
      if (this.numberEl) {
        this.numberEl.textContent = 'Go!';
        this.numberEl.classList.add('is-go');
      }
      if (this.progressEl) {
        this.progressEl.style.strokeDashoffset = `${circumference}`;
        this.progressEl.style.stroke = '#10b981';
      }

      if (this.options.audio !== false) {
        playTickSound(true);
      }

      this.timerId = setTimeout(() => {
        this.finish(true);
      }, 350);
    }
  }

  private finish(proceed: boolean): void {
    if (this.isDestroyed) return;
    this.destroy();
    this.resolvePromise?.(proceed);
  }

  destroy(): void {
    this.isDestroyed = true;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = undefined;
    }
    if (this.hostElement && this.hostElement.parentNode) {
      this.hostElement.parentNode.removeChild(this.hostElement);
    }
    this.hostElement = undefined;
    this.shadowRoot = undefined;
    this.numberEl = undefined;
    this.progressEl = undefined;
  }
}
