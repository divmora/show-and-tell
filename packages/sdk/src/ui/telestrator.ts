import { DrawingEventData, DrawingPoint, DrawingTool, TelestratorConfig } from '../types';

export interface StrokeRecord {
  id: string;
  tool: DrawingTool;
  points: DrawingPoint[];
  color: string;
  strokeWidth: number;
  disappearing: boolean;
  addedAt: number;
  fadeDelayMs: number;
  opacity: number;
}

export const DEFAULT_PALETTE_COLORS = ['#ef4444', '#eab308', '#3b82f6', '#10b981'];

const TELESTRATOR_STYLES = `
:host {
  all: initial;
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none !important;
  z-index: 2147483645;
  overflow: hidden;
  margin: 0;
  padding: 0;
  display: block;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

* {
  box-sizing: border-box;
}

.sat-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  touch-action: none;
}

.sat-canvas.is-active {
  pointer-events: auto;
  cursor: crosshair;
}

.sat-palette {
  position: absolute;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(17, 24, 39, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 9999px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
  pointer-events: auto;
  user-select: none;
  -webkit-user-select: none;
  z-index: 2147483647;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.sat-palette.is-hidden {
  display: none !important;
}

.sat-palette-handle {
  cursor: grab;
  color: rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 2px;
}

.sat-palette-handle:active {
  cursor: grabbing;
}

.sat-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  padding: 0;
  transition: all 0.15s ease;
  position: relative;
}

.sat-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}

.sat-btn.is-selected {
  background: rgba(59, 130, 246, 0.25);
  color: #60a5fa;
  box-shadow: 0 0 0 1.5px #3b82f6;
}

.sat-btn.is-active-toggle {
  background: rgba(234, 179, 8, 0.25);
  color: #facc15;
  box-shadow: 0 0 0 1.5px #eab308;
}

.sat-btn svg {
  width: 17px;
  height: 17px;
  fill: currentColor;
}

.sat-divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 2px;
}

.sat-colors {
  display: flex;
  align-items: center;
  gap: 5px;
}

.sat-color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  outline: none;
}

.sat-color-swatch:hover {
  transform: scale(1.15);
}

.sat-color-swatch.is-selected {
  transform: scale(1.15);
  border-color: #ffffff;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.4);
}
`;

const ICONS = {
  drag: `<svg viewBox="0 0 24 24"><path d="M9 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm10-18a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"/></svg>`,
  pen: `<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
  arrow: `<svg viewBox="0 0 24 24"><path d="M5 19l12.59-12.59H10V4h10v10h-2.41V6.41L5 19z"/></svg>`,
  fade: `<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.59L8.71 12.3a1 1 0 1 1 1.41-1.41L12 12.76l4.29-4.3a1 1 0 1 1 1.41 1.42z"/></svg>`,
  clock: `<svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 vind2 2zm3.3 14.71L11 12.41V7h2v4.59l3.71 3.71-1.42 1.41z"/></svg>`,
  clear: `<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
  close: `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`
};

export class TelestratorOverlay {
  private hostElement?: HTMLElement;
  private shadowRoot?: ShadowRoot;
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D | null;
  private paletteEl?: HTMLElement;
  private penBtn?: HTMLButtonElement;
  private arrowBtn?: HTMLButtonElement;
  private fadeBtn?: HTMLButtonElement;
  private clearBtn?: HTMLButtonElement;
  private closeBtn?: HTMLButtonElement;
  private colorSwatches: HTMLButtonElement[] = [];

  private currentTool: DrawingTool = 'pen';
  private currentColor: string = '#ef4444';
  private strokeWidth: number = 4;
  private disappearingInk: boolean = false;
  private fadeDelayMs: number = 3000;
  private paletteColors: string[] = DEFAULT_PALETTE_COLORS;

  private isActive = false;
  private isDrawing = false;
  private currentStrokePoints: DrawingPoint[] = [];
  private activeStrokes: StrokeRecord[] = [];
  private animationFrameId?: number;
  private cleanupFns: Array<() => void> = [];

  // Palette dragging state
  private isDraggingPalette = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private paletteStartX = 0;
  private paletteStartY = 0;

  // Listeners
  public onDraw?: (data: DrawingEventData) => void;
  public onToggle?: (active: boolean) => void;

  constructor(config?: TelestratorConfig) {
    if (config) {
      if (config.defaultTool) this.currentTool = config.defaultTool;
      if (config.defaultColor) this.currentColor = config.defaultColor;
      if (config.strokeWidth !== undefined) this.strokeWidth = config.strokeWidth;
      if (config.disappearingInk !== undefined) this.disappearingInk = config.disappearingInk;
      if (config.fadeDelayMs !== undefined) this.fadeDelayMs = config.fadeDelayMs;
      if (config.paletteColors && config.paletteColors.length > 0) {
        this.paletteColors = config.paletteColors;
      }
    }
  }

  mount(): void {
    if (typeof document === 'undefined') return;

    this.hostElement = document.createElement('show-and-tell-telestrator');
    this.shadowRoot = this.hostElement.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = TELESTRATOR_STYLES;
    this.shadowRoot.appendChild(styleEl);

    // Canvas overlay
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'sat-canvas';
    this.shadowRoot.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // Floating palette
    this.paletteEl = document.createElement('div');
    this.paletteEl.className = 'sat-palette is-hidden';
    this.paletteEl.innerHTML = `
      <div class="sat-palette-handle" title="Drag palette">
        ${ICONS.drag}
      </div>
      <button class="sat-btn sat-btn-pen is-selected" title="Freehand Pen">
        ${ICONS.pen}
      </button>
      <button class="sat-btn sat-btn-arrow" title="Vector Arrow Pointer">
        ${ICONS.arrow}
      </button>
      <div class="sat-divider"></div>
      <div class="sat-colors">
        ${this.paletteColors.map((color) => `
          <button class="sat-color-swatch ${color === this.currentColor ? 'is-selected' : ''}" 
                  data-color="${color}" 
                  style="background-color: ${color};" 
                  title="Color: ${color}">
          </button>
        `).join('')}
      </div>
      <div class="sat-divider"></div>
      <button class="sat-btn sat-btn-fade ${this.disappearingInk ? 'is-active-toggle' : ''}" title="Auto-fade Ink (3s Disappearing Drawings)">
        ${ICONS.clock}
      </button>
      <button class="sat-btn sat-btn-clear" title="Clear All Drawings (Alt+Shift+X)">
        ${ICONS.clear}
      </button>
      <button class="sat-btn sat-btn-close" title="Exit Drawing Mode / Interact with Page">
        ${ICONS.close}
      </button>
    `;
    this.shadowRoot.appendChild(this.paletteEl);

    document.body.appendChild(this.hostElement);

    // Grab elements
    this.penBtn = this.paletteEl.querySelector('.sat-btn-pen') as HTMLButtonElement;
    this.arrowBtn = this.paletteEl.querySelector('.sat-btn-arrow') as HTMLButtonElement;
    this.fadeBtn = this.paletteEl.querySelector('.sat-btn-fade') as HTMLButtonElement;
    this.clearBtn = this.paletteEl.querySelector('.sat-btn-clear') as HTMLButtonElement;
    this.closeBtn = this.paletteEl.querySelector('.sat-btn-close') as HTMLButtonElement;
    this.colorSwatches = Array.from(this.paletteEl.querySelectorAll('.sat-color-swatch'));

    this.resizeCanvas();
    this.setupEventListeners();
  }

  private resizeCanvas(): void {
    if (!this.canvas || !this.ctx || typeof window === 'undefined') return;

    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);

    this.redraw();
  }

  private setupEventListeners(): void {
    if (typeof window === 'undefined' || !this.canvas || !this.paletteEl) return;

    // Window resize
    const handleResize = () => this.resizeCanvas();
    window.addEventListener('resize', handleResize);
    this.cleanupFns.push(() => window.removeEventListener('resize', handleResize));

    // Pointer events on canvas
    const onPointerDown = (e: PointerEvent) => this.handlePointerDown(e);
    const onPointerMove = (e: PointerEvent) => this.handlePointerMove(e);
    const onPointerUp = (e: PointerEvent) => this.handlePointerUp(e);
    const onPointerCancel = (e: PointerEvent) => this.handlePointerUp(e);

    this.canvas.addEventListener('pointerdown', onPointerDown);
    this.canvas.addEventListener('pointermove', onPointerMove);
    this.canvas.addEventListener('pointerup', onPointerUp);
    this.canvas.addEventListener('pointercancel', onPointerCancel);

    this.cleanupFns.push(() => {
      this.canvas?.removeEventListener('pointerdown', onPointerDown);
      this.canvas?.removeEventListener('pointermove', onPointerMove);
      this.canvas?.removeEventListener('pointerup', onPointerUp);
      this.canvas?.removeEventListener('pointercancel', onPointerCancel);
    });

    // Palette UI event listeners
    this.penBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setTool('pen');
    });

    this.arrowBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setTool('arrow');
    });

    this.colorSwatches.forEach((swatch) => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = swatch.getAttribute('data-color');
        if (color) this.setColor(color);
      });
    });

    this.fadeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDisappearingInk();
    });

    this.clearBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clear();
    });

    this.closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setActive(false);
    });

    // Draggable palette
    this.setupDraggablePalette();
  }

  private setupDraggablePalette(): void {
    const handle = this.paletteEl?.querySelector('.sat-palette-handle') as HTMLElement;
    if (!handle || !this.paletteEl) return;

    const onMouseDown = (e: MouseEvent) => {
      this.isDraggingPalette = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      const rect = this.paletteEl!.getBoundingClientRect();
      this.paletteStartX = rect.left;
      this.paletteStartY = rect.top;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!this.isDraggingPalette || !this.paletteEl) return;
      const deltaX = e.clientX - this.dragStartX;
      const deltaY = e.clientY - this.dragStartY;

      let newX = this.paletteStartX + deltaX;
      let newY = this.paletteStartY + deltaY;

      const rect = this.paletteEl.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width - 10;
      const maxY = window.innerHeight - rect.height - 10;

      newX = Math.max(10, Math.min(newX, maxX));
      newY = Math.max(10, Math.min(newY, maxY));

      this.paletteEl.style.left = `${newX}px`;
      this.paletteEl.style.top = `${newY}px`;
      this.paletteEl.style.transform = 'none';
    };

    const onMouseUp = () => {
      this.isDraggingPalette = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    handle.addEventListener('mousedown', onMouseDown);
  }

  // --- Drawing logic ---

  private handlePointerDown(e: PointerEvent): void {
    if (!this.isActive || e.button !== 0) return;

    this.isDrawing = true;
    const point: DrawingPoint = { x: Math.round(e.clientX), y: Math.round(e.clientY) };
    this.currentStrokePoints = [point];

    if (this.currentTool === 'pen') {
      this.drawPenSegment(point, point, this.currentColor, this.strokeWidth);
    }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.isDrawing || !this.isActive) return;

    const point: DrawingPoint = { x: Math.round(e.clientX), y: Math.round(e.clientY) };

    if (this.currentTool === 'pen') {
      const prevPoint = this.currentStrokePoints[this.currentStrokePoints.length - 1];
      this.currentStrokePoints.push(point);
      this.drawPenSegment(prevPoint, point, this.currentColor, this.strokeWidth);
    } else if (this.currentTool === 'arrow') {
      // For arrow, redraw active strokes + live arrow preview from start to current
      this.currentStrokePoints = [this.currentStrokePoints[0], point];
      this.redraw();
      this.drawArrow(this.currentStrokePoints[0], point, this.currentColor, this.strokeWidth);
    }
  }

  private handlePointerUp(_e: PointerEvent): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    if (this.currentStrokePoints.length === 0) return;

    if (this.currentTool === 'arrow' && this.currentStrokePoints.length === 1) {
      // If user tapped without dragging, make a small default arrow
      const start = this.currentStrokePoints[0];
      this.currentStrokePoints.push({ x: start.x + 40, y: start.y - 40 });
    }

    const strokeRecord: StrokeRecord = {
      id: `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tool: this.currentTool,
      points: [...this.currentStrokePoints],
      color: this.currentColor,
      strokeWidth: this.strokeWidth,
      disappearing: this.disappearingInk,
      addedAt: performance.now(),
      fadeDelayMs: this.fadeDelayMs,
      opacity: 1
    };

    this.activeStrokes.push(strokeRecord);
    this.redraw();

    // Emit drawing event
    this.onDraw?.({
      action: 'draw',
      tool: this.currentTool,
      points: strokeRecord.points,
      color: strokeRecord.color,
      strokeWidth: strokeRecord.strokeWidth,
      disappearing: strokeRecord.disappearing,
      fadeAfterMs: strokeRecord.fadeDelayMs
    });

    if (strokeRecord.disappearing) {
      this.startFadeLoop();
    }
  }

  private drawPenSegment(p1: DrawingPoint, p2: DrawingPoint, color: string, width: number, opacity: number = 1): void {
    if (!this.ctx) return;

    this.ctx.save();
    this.ctx.globalAlpha = opacity;
    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    if (p1.x === p2.x && p1.y === p2.y) {
      this.ctx.beginPath();
      this.ctx.arc(p1.x, p1.y, width / 2, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  private drawArrow(start: DrawingPoint, end: DrawingPoint, color: string, width: number, opacity: number = 1): void {
    if (!this.ctx) return;

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 4) return;

    this.ctx.save();
    this.ctx.globalAlpha = opacity;
    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    const angle = Math.atan2(dy, dx);
    const headLength = Math.max(14, width * 3.5);
    const arrowAngle = Math.PI / 6; // 30 deg

    // Draw main line
    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.stroke();

    // Draw solid arrowhead
    this.ctx.beginPath();
    this.ctx.moveTo(end.x, end.y);
    this.ctx.lineTo(
      end.x - headLength * Math.cos(angle - arrowAngle),
      end.y - headLength * Math.sin(angle - arrowAngle)
    );
    this.ctx.lineTo(
      end.x - (headLength * 0.65) * Math.cos(angle),
      end.y - (headLength * 0.65) * Math.sin(angle)
    );
    this.ctx.lineTo(
      end.x - headLength * Math.cos(angle + arrowAngle),
      end.y - headLength * Math.sin(angle + arrowAngle)
    );
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();
  }

  private redraw(): void {
    if (!this.ctx || !this.canvas) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    this.ctx.clearRect(0, 0, width, height);

    for (const stroke of this.activeStrokes) {
      if (stroke.opacity <= 0) continue;

      if (stroke.tool === 'pen') {
        if (stroke.points.length === 1) {
          this.drawPenSegment(stroke.points[0], stroke.points[0], stroke.color, stroke.strokeWidth, stroke.opacity);
        } else {
          for (let i = 1; i < stroke.points.length; i++) {
            this.drawPenSegment(stroke.points[i - 1], stroke.points[i], stroke.color, stroke.strokeWidth, stroke.opacity);
          }
        }
      } else if (stroke.tool === 'arrow') {
        if (stroke.points.length >= 2) {
          this.drawArrow(stroke.points[0], stroke.points[1], stroke.color, stroke.strokeWidth, stroke.opacity);
        }
      }
    }
  }

  private startFadeLoop(): void {
    if (this.animationFrameId !== undefined) return;

    const tick = () => {
      const now = performance.now();
      let hasDisappearing = false;

      for (const stroke of this.activeStrokes) {
        if (!stroke.disappearing) continue;

        const elapsed = now - stroke.addedAt;
        if (elapsed >= stroke.fadeDelayMs) {
          stroke.opacity = 0;
        } else if (elapsed > stroke.fadeDelayMs - 600) {
          stroke.opacity = Math.max(0, (stroke.fadeDelayMs - elapsed) / 600);
          hasDisappearing = true;
        } else {
          stroke.opacity = 1;
          hasDisappearing = true;
        }
      }

      // Evict expired strokes
      this.activeStrokes = this.activeStrokes.filter((s) => s.opacity > 0);
      this.redraw();

      if (hasDisappearing) {
        this.animationFrameId = requestAnimationFrame(tick);
      } else {
        this.animationFrameId = undefined;
      }
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  // --- Public Control APIs ---

  public toggle(): boolean {
    return this.setActive(!this.isActive);
  }

  public setActive(active: boolean): boolean {
    this.isActive = active;

    if (this.canvas) {
      this.canvas.classList.toggle('is-active', this.isActive);
    }

    if (this.paletteEl) {
      this.paletteEl.classList.toggle('is-hidden', !this.isActive);
    }

    this.onToggle?.(this.isActive);
    return this.isActive;
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public setTool(tool: DrawingTool): void {
    this.currentTool = tool;
    this.penBtn?.classList.toggle('is-selected', tool === 'pen');
    this.arrowBtn?.classList.toggle('is-selected', tool === 'arrow');
  }

  public getTool(): DrawingTool {
    return this.currentTool;
  }

  public setColor(color: string): void {
    this.currentColor = color;
    this.colorSwatches.forEach((swatch) => {
      const swatchColor = swatch.getAttribute('data-color');
      swatch.classList.toggle('is-selected', swatchColor === color);
    });
  }

  public getColor(): string {
    return this.currentColor;
  }

  public toggleDisappearingInk(): boolean {
    this.disappearingInk = !this.disappearingInk;
    this.fadeBtn?.classList.toggle('is-active-toggle', this.disappearingInk);
    return this.disappearingInk;
  }

  public setDisappearingInk(enabled: boolean): void {
    this.disappearingInk = enabled;
    this.fadeBtn?.classList.toggle('is-active-toggle', this.disappearingInk);
  }

  public getDisappearingInk(): boolean {
    return this.disappearingInk;
  }

  public clear(): void {
    this.activeStrokes = [];
    if (this.animationFrameId !== undefined) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }
    this.redraw();
    this.onDraw?.({ action: 'clear' });
  }

  public getActiveStrokes(): StrokeRecord[] {
    return [...this.activeStrokes];
  }

  public addExternalStroke(stroke: StrokeRecord): void {
    this.activeStrokes.push(stroke);
    this.redraw();
    if (stroke.disappearing) {
      this.startFadeLoop();
    }
  }

  public destroy(): void {
    if (this.animationFrameId !== undefined) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }

    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];

    if (this.hostElement && this.hostElement.parentNode) {
      this.hostElement.parentNode.removeChild(this.hostElement);
    }
  }
}
