import { DurationStats, RecordingSession } from '../types';
import { WIDGET_STYLES } from './styles';

const ICONS = {
  drag: `<svg class="sat-icon" viewBox="0 0 24 24"><path d="M9 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm10-18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/></svg>`,
  pause: `<svg class="sat-icon" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
  play: `<svg class="sat-icon" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
  stop: `<svg class="sat-icon" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>`,
  micOn: `<svg class="sat-icon" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>`,
  micOff: `<svg class="sat-icon" viewBox="0 0 24 24"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17L12.06 8.25c.01-.08.02-.16.02-.25V5c0-1.66-1.34-3-3-3-.25 0-.49.04-.71.1l7.61 7.61v1.71zm-9.74-7.9 1.41-1.41L21.19 19.4l-1.41 1.41-4.22-4.22C14.47 17.37 13.3 18 12 18c-3.41 0-6.23-2.72-6.72-6H3.58C4.06 15.28 6.78 18.1 10 18.58V21h2v-2.42c.86-.13 1.66-.43 2.37-.87l-7.13-7.14V11H5.58c0 .28.03.55.08.81L4.24 3.27z"/></svg>`
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
  private unsubscribeTick?: () => void;

  // Dragging state
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private widgetStartX = 0;
  private widgetStartY = 0;

  constructor(private session: RecordingSession, private hasMic: boolean = false) {}

  mount(): void {
    if (typeof document === 'undefined') return;

    this.hostElement = document.createElement('show-and-tell-widget');
    this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = WIDGET_STYLES;
    this.shadowRoot.appendChild(styleEl);

    this.containerEl = document.createElement('div');
    this.containerEl.className = 'sat-widget-container';
    this.containerEl.innerHTML = `
      <div class="sat-drag-handle" title="Drag to reposition">
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
          <button class="sat-btn sat-btn-mic" title="Mute/Unmute Mic">
            ${ICONS.micOn}
          </button>
        ` : ''}
        <button class="sat-btn sat-btn-pause" title="Pause/Resume">
          ${ICONS.pause}
        </button>
        <button class="sat-btn sat-btn-stop" title="Stop Recording">
          ${ICONS.stop}
        </button>
      </div>
    `;

    this.shadowRoot.appendChild(this.containerEl);
    document.body.appendChild(this.hostElement);

    this.timerTextEl = this.containerEl.querySelector('.sat-timer-text') as HTMLElement;
    this.timerSubEl = this.containerEl.querySelector('.sat-timer-sub') as HTMLElement;
    this.pauseBtn = this.containerEl.querySelector('.sat-btn-pause') as HTMLButtonElement;
    this.stopBtn = this.containerEl.querySelector('.sat-btn-stop') as HTMLButtonElement;
    if (this.hasMic) {
      this.micBtn = this.containerEl.querySelector('.sat-btn-mic') as HTMLButtonElement;
    }

    this.setupListeners();
    this.setupDraggable();
  }

  private setupListeners(): void {
    if (this.pauseBtn) {
      this.pauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.session.state === 'recording') {
          this.session.pause();
          this.pauseBtn!.innerHTML = ICONS.play;
          this.pauseBtn!.title = 'Resume Recording';
          this.containerEl?.classList.add('sat-paused');
        } else if (this.session.state === 'paused') {
          this.session.resume();
          this.pauseBtn!.innerHTML = ICONS.pause;
          this.pauseBtn!.title = 'Pause Recording';
          this.containerEl?.classList.remove('sat-paused');
        }
      });
    }

    if (this.micBtn) {
      this.micBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isMuted = this.session.toggleMic();
        this.micBtn!.innerHTML = isMuted ? ICONS.micOff : ICONS.micOn;
        this.micBtn!.title = isMuted ? 'Unmute Mic' : 'Mute Mic';
        this.micBtn!.classList.toggle('sat-btn-active-toggle', isMuted);
      });
    }

    if (this.stopBtn) {
      this.stopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.session.stop();
      });
    }

    // Subscribe to duration updates
    this.unsubscribeTick = this.session.on('tick', (stats: DurationStats) => {
      this.updateStats(stats);
    });
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

  destroy(): void {
    if (this.unsubscribeTick) {
      this.unsubscribeTick();
      this.unsubscribeTick = undefined;
    }
    if (this.hostElement && this.hostElement.parentNode) {
      this.hostElement.parentNode.removeChild(this.hostElement);
    }
  }
}
