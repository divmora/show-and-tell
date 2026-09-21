import { DurationStats, RecordingSession, ThemeConfig, HotkeyConfig } from '../types';
import { WIDGET_STYLES } from './styles';
import { applyThemeToHost } from './theme';
import { formatHotkeyLabel, DEFAULT_HOTKEYS } from './hotkeys';

function resolveShortcut(keyVal: string | false | undefined, fallback: string | false): string {
  if (keyVal === false) return '';
  const chosen = keyVal || fallback;
  if (!chosen) return '';
  return formatHotkeyLabel(chosen);
}

const ICONS = {
  drag: `<svg class="sat-icon" viewBox="0 0 24 24"><path d="M9 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm10-18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/></svg>`,
  pause: `<svg class="sat-icon" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
  play: `<svg class="sat-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
  stop: `<svg class="sat-icon" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>`,
  micOn: `<svg class="sat-icon" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>`,
  micOff: `<svg class="sat-icon" viewBox="0 0 24 24"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17L12.06 8.25c.01-.08.02-.16.02-.25V5c0-1.66-1.34-3-3-3-.25 0-.49.04-.71.1l7.61 7.61v1.71zm-9.74-7.9 1.41-1.41L21.19 19.4l-1.41 1.41-4.22-4.22C14.47 17.37 13.3 18 12 18c-3.41 0-6.23-2.72-6.72-6H3.58C4.06 15.28 6.78 18.1 10 18.58V21h2v-2.42c.86-.13 1.66-.43 2.37-.87l-7.13-7.14V11H5.58c0 .28.03.55.08.81L4.24 3.27z"/></svg>`,
  pip: `<svg class="sat-icon" viewBox="0 0 24 24"><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>`,
  spotlight: `<svg class="sat-icon" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 17.93V19a1 1 0 0 1-2 0v-.07A8 8 0 0 1 4.07 13H5a1 1 0 0 1 0-2h-.93A8 8 0 0 1 11 4.07V5a1 1 0 0 1 2 0v-.07A8 8 0 0 1 19.93 11H19a1 1 0 0 1 0 2h.93A8 8 0 0 1 13 18.93zM12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4z"/></svg>`,
  draw: `<svg class="sat-icon" viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`
};

export class RecordingWidget {
  private hostElement?: HTMLElement;
  private shadowRoot?: ShadowRoot;
  private containerEl?: HTMLElement;
  private timerTextEl?: HTMLElement;
  private timerSubEl?: HTMLElement;
  private pauseBtn?: HTMLButtonElement;
  private micBtn?: HTMLButtonElement;
  private stopBtn?: HTMLButtonElement;
  private pipBtn?: HTMLButtonElement;
  private spotlightBtn?: HTMLButtonElement;
  private drawBtn?: HTMLButtonElement;
  private vuMeterEl?: HTMLElement;
  private silentWarningEl?: HTMLElement;
  private unsubscribeTick?: () => void;
  private unsubscribeSpotlight?: () => void;
  private unsubscribeTelestrator?: () => void;
  private unsubscribeAudioLevel?: () => void;
  private unsubscribeSilentWarning?: () => void;
  private unsubscribePause?: () => void;
  private unsubscribeResume?: () => void;
  private unsubscribeMicMute?: () => void;
  private hotkeys?: boolean | HotkeyConfig;

  public onPopoutRequest?: () => void;

  // Dragging state
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private widgetStartX = 0;
  private widgetStartY = 0;

  constructor(
    private session: RecordingSession,
    private hasMic: boolean = false,
    private theme?: ThemeConfig,
    hotkeys?: boolean | HotkeyConfig
  ) {
    this.hotkeys = hotkeys;
  }

  /**
   * Dynamically updates the widget's visual theme tokens and color mode.
   */
  public setTheme(theme: ThemeConfig): void {
    this.theme = theme;
    if (this.hostElement) {
      applyThemeToHost(this.hostElement, this.theme);
    }
  }

  mount(): void {
    if (typeof document === 'undefined') return;

    this.hostElement = document.createElement('show-and-tell-widget');
    this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });

    applyThemeToHost(this.hostElement, this.theme);

    const styleEl = document.createElement('style');
    styleEl.textContent = WIDGET_STYLES;
    this.shadowRoot.appendChild(styleEl);

    const hotkeyCfg = typeof this.hotkeys === 'object' ? this.hotkeys : {};
    const isHotkeysEnabled = this.hotkeys !== false && hotkeyCfg.enabled !== false;
    const pauseHotkey = isHotkeysEnabled ? resolveShortcut(hotkeyCfg.togglePause, DEFAULT_HOTKEYS.togglePause) : '';
    const stopHotkey = isHotkeysEnabled ? resolveShortcut(hotkeyCfg.toggleRecording, DEFAULT_HOTKEYS.toggleRecording) : '';
    const micHotkey = isHotkeysEnabled ? resolveShortcut(hotkeyCfg.toggleMic, DEFAULT_HOTKEYS.toggleMic) : '';
    const spotlightHotkey = isHotkeysEnabled ? resolveShortcut(hotkeyCfg.toggleSpotlight, DEFAULT_HOTKEYS.toggleSpotlight) : '';
    const drawHotkey = isHotkeysEnabled ? resolveShortcut(hotkeyCfg.toggleTelestrator, DEFAULT_HOTKEYS.toggleTelestrator) : '';

    this.containerEl = document.createElement('div');
    this.containerEl.className = 'sat-widget-container';
    this.containerEl.innerHTML = `
      <div class="sat-silent-warning" style="display: none;">
        <svg class="sat-silent-warning-icon" viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
        <span>Microphone seems silent</span>
      </div>
      <div class="sat-drag-handle" title="Drag toolbar">
        ${ICONS.drag}
      </div>
      <div class="sat-status-indicator">
        <div class="sat-dot"></div>
      </div>
      <div class="sat-timer-group">
        <div class="sat-timer-text">00:00</div>
        <div class="sat-timer-sub"></div>
      </div>
      <div class="sat-divider"></div>
      <div class="sat-btn-group">
        ${this.hasMic ? `
          <div class="sat-mic-wrapper">
            <button class="sat-btn sat-btn-mic" title="${micHotkey ? `Mute/Unmute Mic (${micHotkey})` : 'Mute/Unmute Mic'}">
              ${ICONS.micOn}
            </button>
            <div class="sat-vu-meter" title="Microphone Level" data-level="0">
              <span class="sat-vu-bar sat-vu-bar-1"></span>
              <span class="sat-vu-bar sat-vu-bar-2"></span>
              <span class="sat-vu-bar sat-vu-bar-3"></span>
            </div>
          </div>
        ` : ''}
        <button class="sat-btn sat-btn-pause" title="${pauseHotkey ? `Pause/Resume (${pauseHotkey})` : 'Pause/Resume'}">
          ${ICONS.pause}
        </button>
        <button class="sat-btn sat-btn-stop" title="${stopHotkey ? `Stop Recording (${stopHotkey})` : 'Stop Recording'}">
          ${ICONS.stop}
        </button>
        <button class="sat-btn sat-btn-spotlight" title="${spotlightHotkey ? `Toggle Cursor Spotlight (${spotlightHotkey})` : 'Toggle Cursor Spotlight'}">
          ${ICONS.spotlight}
        </button>
        <button class="sat-btn sat-btn-draw" title="${drawHotkey ? `Annotate / Draw (${drawHotkey})` : 'Annotate / Draw'}">
          ${ICONS.draw}
        </button>
        <button class="sat-btn sat-btn-pip" title="Float over all apps (Always-on-Top PiP across windows and tabs)">
          ${ICONS.pip}
        </button>
      </div>
    `;

    this.shadowRoot.appendChild(this.containerEl);
    document.body.appendChild(this.hostElement);

    this.timerTextEl = this.containerEl.querySelector('.sat-timer-text') as HTMLElement;
    this.timerSubEl = this.containerEl.querySelector('.sat-timer-sub') as HTMLElement;
    this.pauseBtn = this.containerEl.querySelector('.sat-btn-pause') as HTMLButtonElement;
    this.stopBtn = this.containerEl.querySelector('.sat-btn-stop') as HTMLButtonElement;
    this.spotlightBtn = this.containerEl.querySelector('.sat-btn-spotlight') as HTMLButtonElement;
    this.drawBtn = this.containerEl.querySelector('.sat-btn-draw') as HTMLButtonElement;
    this.pipBtn = this.containerEl.querySelector('.sat-btn-pip') as HTMLButtonElement;
    if (this.hasMic) {
      this.micBtn = this.containerEl.querySelector('.sat-btn-mic') as HTMLButtonElement;
      this.vuMeterEl = this.containerEl.querySelector('.sat-vu-meter') as HTMLElement;
      this.silentWarningEl = this.containerEl.querySelector('.sat-silent-warning') as HTMLElement;
      if (this.vuMeterEl) {
        this.vuMeterEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.micBtn?.click();
        });
      }
    }

    if (this.session.isSpotlightActive?.()) {
      this.updateSpotlightBtn(true);
    }

    if (this.session.isTelestratorActive?.()) {
      this.updateDrawBtn(true);
    }

    this.setupListeners();
    this.setupDraggable();
  }

  private setupListeners(): void {
    const hotkeyCfg = typeof this.hotkeys === 'object' ? this.hotkeys : {};
    const isHotkeysEnabled = this.hotkeys !== false && hotkeyCfg.enabled !== false;
    const pauseHotkey = isHotkeysEnabled ? resolveShortcut(hotkeyCfg.togglePause, DEFAULT_HOTKEYS.togglePause) : '';
    const micHotkey = isHotkeysEnabled ? resolveShortcut(hotkeyCfg.toggleMic, DEFAULT_HOTKEYS.toggleMic) : '';

    if (this.pauseBtn) {
      this.pauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.session.state === 'recording') {
          this.session.pause();
        } else if (this.session.state === 'paused') {
          this.session.resume();
        }
      });

      this.unsubscribePause = this.session.on('pause', () => {
        if (this.pauseBtn) {
          this.pauseBtn.innerHTML = ICONS.play;
          this.pauseBtn.title = pauseHotkey ? `Resume Recording (${pauseHotkey})` : 'Resume Recording';
        }
        this.containerEl?.classList.add('sat-paused');
      });

      this.unsubscribeResume = this.session.on('resume', () => {
        if (this.pauseBtn) {
          this.pauseBtn.innerHTML = ICONS.pause;
          this.pauseBtn.title = pauseHotkey ? `Pause Recording (${pauseHotkey})` : 'Pause Recording';
        }
        this.containerEl?.classList.remove('sat-paused');
      });
    }

    if (this.spotlightBtn) {
      this.spotlightBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const active = this.session.toggleSpotlight();
        this.updateSpotlightBtn(active);
      });

      this.unsubscribeSpotlight = this.session.on('spotlightChange', (active: boolean) => {
        this.updateSpotlightBtn(active);
      });
    }

    if (this.drawBtn) {
      this.drawBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const active = this.session.toggleTelestrator?.() ?? false;
        this.updateDrawBtn(active);
      });

      this.unsubscribeTelestrator = this.session.on('telestratorToggle', (active: boolean) => {
        this.updateDrawBtn(active);
      });
    }

    if (this.micBtn) {
      const handleMicToggle = (isMuted: boolean) => {
        if (this.micBtn) {
          this.micBtn.innerHTML = isMuted ? ICONS.micOff : ICONS.micOn;
          this.micBtn.title = isMuted
            ? (micHotkey ? `Unmute Mic (${micHotkey})` : 'Unmute Mic')
            : (micHotkey ? `Mute Mic (${micHotkey})` : 'Mute Mic');
          this.micBtn.classList.toggle('sat-btn-active-toggle', isMuted);
        }
        this.vuMeterEl?.classList.toggle('is-muted', isMuted);
        if (isMuted) {
          this.updateAudioLevel(0);
          this.updateSilentWarning(false);
        }
      };

      this.micBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isMuted = this.session.toggleMic();
        handleMicToggle(isMuted);
      });

      this.unsubscribeMicMute = this.session.on('micMuteChange', (isMuted: boolean) => {
        handleMicToggle(isMuted);
      });
    }

    if (this.hasMic) {
      this.unsubscribeAudioLevel = this.session.on('audioLevel', (data: any) => {
        this.updateAudioLevel(data?.level ?? 0);
      });

      this.unsubscribeSilentWarning = this.session.on('silentMicWarning', (active: boolean) => {
        this.updateSilentWarning(active);
      });
    }

    if (this.stopBtn) {
      this.stopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.session.stop();
      });
    }

    if (this.pipBtn) {
      this.pipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onPopoutRequest?.();
      });
    }

    // Subscribe to duration updates
    this.unsubscribeTick = this.session.on('tick', (stats: DurationStats) => {
      this.updateStats(stats);
    });
  }

  hide(): void {
    if (this.hostElement) {
      this.hostElement.style.display = 'none';
    }
  }

  show(): void {
    if (this.hostElement) {
      this.hostElement.style.display = '';
    }
  }

  private updateStats(stats: DurationStats): void {
    if (!this.timerTextEl || !this.containerEl) return;

    if (stats.maxDurationSeconds !== undefined) {
      this.timerTextEl.textContent = `${stats.formattedElapsed} / ${stats.formattedMaxDuration}`;
      if (this.timerSubEl && stats.formattedRemaining) {
        this.timerSubEl.textContent = `${stats.formattedRemaining} remaining`;
      }
    } else {
      this.timerTextEl.textContent = stats.formattedElapsed;
      if (this.timerSubEl) {
        this.timerSubEl.textContent = '';
      }
    }

    // Toggle warning styling
    if (stats.isWarning) {
      this.containerEl.classList.add('sat-warning');
    } else {
      this.containerEl.classList.remove('sat-warning');
    }

    // Handle pause state
    if (stats.isPaused) {
      this.containerEl.classList.add('sat-paused');
      if (this.pauseBtn) this.pauseBtn.innerHTML = ICONS.play;
    } else {
      this.containerEl.classList.remove('sat-paused');
      if (this.pauseBtn) this.pauseBtn.innerHTML = ICONS.pause;
    }
  }

  private setupDraggable(): void {
    const handle = this.containerEl?.querySelector('.sat-drag-handle') as HTMLElement;
    if (!handle || !this.containerEl) return;

    const onMouseDown = (e: MouseEvent) => {
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      const rect = this.containerEl!.getBoundingClientRect();
      this.widgetStartX = rect.left;
      this.widgetStartY = rect.top;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isDragging || !this.containerEl) return;
      const deltaX = e.clientX - this.dragStartX;
      const deltaY = e.clientY - this.dragStartY;

      let newX = this.widgetStartX + deltaX;
      let newY = this.widgetStartY + deltaY;

      // Bound within viewport
      const rect = this.containerEl.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width - 10;
      const maxY = window.innerHeight - rect.height - 10;

      newX = Math.max(10, Math.min(newX, maxX));
      newY = Math.max(10, Math.min(newY, maxY));

      this.containerEl.style.left = `${newX}px`;
      this.containerEl.style.top = `${newY}px`;
      this.containerEl.style.bottom = 'auto';
      this.containerEl.style.right = 'auto';
    };

    const onMouseUp = () => {
      this.isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', onMouseDown);
  }

  private updateSpotlightBtn(active: boolean): void {
    if (!this.spotlightBtn) return;
    if (active) {
      this.spotlightBtn.classList.add('sat-btn-active-spotlight');
      this.spotlightBtn.title = 'Turn Off Cursor Spotlight';
    } else {
      this.spotlightBtn.classList.remove('sat-btn-active-spotlight');
      this.spotlightBtn.title = 'Turn On Cursor Spotlight';
    }
  }

  private updateDrawBtn(active: boolean): void {
    if (!this.drawBtn) return;
    if (active) {
      this.drawBtn.classList.add('sat-btn-active-toggle');
    } else {
      this.drawBtn.classList.remove('sat-btn-active-toggle');
    }
  }

  private updateAudioLevel(level: 0 | 1 | 2 | 3): void {
    if (!this.vuMeterEl) return;
    this.vuMeterEl.setAttribute('data-level', String(level));
  }

  private updateSilentWarning(active: boolean): void {
    if (!this.silentWarningEl) return;
    this.silentWarningEl.style.display = active ? 'inline-flex' : 'none';
  }

  destroy(): void {
    if (this.unsubscribeTick) {
      this.unsubscribeTick();
      this.unsubscribeTick = undefined;
    }
    if (this.unsubscribeSpotlight) {
      this.unsubscribeSpotlight();
      this.unsubscribeSpotlight = undefined;
    }
    if (this.unsubscribeTelestrator) {
      this.unsubscribeTelestrator();
      this.unsubscribeTelestrator = undefined;
    }
    if (this.unsubscribeAudioLevel) {
      this.unsubscribeAudioLevel();
      this.unsubscribeAudioLevel = undefined;
    }
    if (this.unsubscribeSilentWarning) {
      this.unsubscribeSilentWarning();
      this.unsubscribeSilentWarning = undefined;
    }
    if (this.unsubscribePause) {
      this.unsubscribePause();
      this.unsubscribePause = undefined;
    }
    if (this.unsubscribeResume) {
      this.unsubscribeResume();
      this.unsubscribeResume = undefined;
    }
    if (this.unsubscribeMicMute) {
      this.unsubscribeMicMute();
      this.unsubscribeMicMute = undefined;
    }
    if (this.hostElement && this.hostElement.parentNode) {
      this.hostElement.parentNode.removeChild(this.hostElement);
    }
  }
}
