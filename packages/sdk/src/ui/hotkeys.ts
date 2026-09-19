import { HotkeyConfig, RecordingSession } from '../types';

export interface ParsedHotkey {
  raw: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  key: string;
  code?: string;
}

export const DEFAULT_HOTKEYS: Required<Omit<HotkeyConfig, 'target'>> = {
  enabled: true,
  toggleRecording: 'Alt+Shift+R',
  togglePause: 'Alt+Shift+P',
  toggleMic: 'Alt+Shift+M',
  toggleCamera: 'Alt+Shift+C',
  toggleSpotlight: 'Alt+Shift+S',
  discardRecording: 'Alt+Shift+D',
  preventInputCollision: true
};

/**
 * Checks if current operating environment is macOS / iOS.
 */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
}

/**
 * Formats a hotkey combination into a human-readable display string.
 * On macOS, renders standard symbol glyphs (e.g. ⌥⇧R); on Windows/Linux, renders e.g. Alt+Shift+R.
 */
export function formatHotkeyLabel(combo: string): string {
  if (!combo) return '';
  const parts = combo.split(/[+-]/).map((p) => p.trim());
  const mac = isMac();

  if (mac) {
    const symbols: string[] = [];
    let char = '';
    for (const p of parts) {
      const lower = p.toLowerCase();
      if (lower === 'alt' || lower === 'option') symbols.push('⌥');
      else if (lower === 'shift') symbols.push('⇧');
      else if (lower === 'ctrl' || lower === 'control') symbols.push('⌃');
      else if (lower === 'cmd' || lower === 'command' || lower === 'meta') symbols.push('⌘');
      else char = p.toUpperCase();
    }
    return `${symbols.join('')}${char}`;
  }

  return parts
    .map((p) => {
      const lower = p.toLowerCase();
      if (lower === 'ctrl' || lower === 'control') return 'Ctrl';
      if (lower === 'alt' || lower === 'option') return 'Alt';
      if (lower === 'shift') return 'Shift';
      if (lower === 'cmd' || lower === 'command' || lower === 'meta') return 'Win';
      return p.toUpperCase();
    })
    .join('+');
}

/**
 * Parses a key combination string like 'Alt+Shift+R' into normalized matcher fields.
 */
export function parseHotkey(combo: string): ParsedHotkey | null {
  if (!combo || typeof combo !== 'string') return null;
  const parts = combo.split(/[+-]/).map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (parts.length === 0) return null;

  let altKey = false;
  let ctrlKey = false;
  let metaKey = false;
  let shiftKey = false;
  let key = '';
  let code: string | undefined;

  for (const p of parts) {
    if (p === 'alt' || p === 'option') {
      altKey = true;
    } else if (p === 'ctrl' || p === 'control') {
      ctrlKey = true;
    } else if (p === 'meta' || p === 'cmd' || p === 'command') {
      metaKey = true;
    } else if (p === 'shift') {
      shiftKey = true;
    } else {
      key = p;
      if (p === 'esc' || p === 'escape') {
        key = 'escape';
        code = 'Escape';
      } else if (p === 'space') {
        key = ' ';
        code = 'Space';
      } else if (p === 'enter' || p === 'return') {
        key = 'enter';
        code = 'Enter';
      } else if (p.length === 1 && p >= 'a' && p <= 'z') {
        code = `Key${p.toUpperCase()}`;
      } else if (p.length === 1 && p >= '0' && p <= '9') {
        code = `Digit${p}`;
      }
    }
  }

  if (!key) return null;

  return {
    raw: combo,
    altKey,
    ctrlKey,
    metaKey,
    shiftKey,
    key,
    code
  };
}

/**
 * Tests whether a KeyboardEvent matches a parsed hotkey definition.
 * Accurately supports macOS Alt-modified dead keys (e.g. Option+R emitting '®') via code fallbacks.
 */
export function matchesHotkey(event: KeyboardEvent, parsed: ParsedHotkey): boolean {
  if (event.altKey !== parsed.altKey) return false;
  if (event.ctrlKey !== parsed.ctrlKey) return false;
  if (event.metaKey !== parsed.metaKey) return false;
  if (event.shiftKey !== parsed.shiftKey) return false;

  const eventKey = (event.key || '').toLowerCase();

  // 1. Direct key match (e.g. 'r' === 'r', 'escape' === 'escape')
  if (eventKey === parsed.key) {
    return true;
  }

  // 2. Physical code match (handles macOS Option/Alt special symbols like Alt+R -> '®' with code: 'KeyR')
  if (parsed.code && event.code === parsed.code) {
    return true;
  }

  return false;
}

/**
 * Inspects whether the target element is an interactive editable text control
 * to avoid hijacking regular typing in form fields.
 */
export function isEditableElement(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;

  const el = target as HTMLElement;

  // Form input elements
  const tag = (el.tagName || '').toLowerCase();
  if (tag === 'textarea' || tag === 'select') {
    return true;
  }

  if (tag === 'input') {
    const inputType = ((el as HTMLInputElement).type || 'text').toLowerCase();
    // Allow hotkeys on non-textual input types (checkbox, radio, button, range)
    const nonTextInputs = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color'];
    return !nonTextInputs.includes(inputType);
  }

  // Contenteditable elements
  if (el.isContentEditable) {
    return true;
  }

  const contentEditableAttr = el.getAttribute?.('contenteditable');
  if (contentEditableAttr === 'true' || contentEditableAttr === '') {
    return true;
  }

  return false;
}

export interface HotkeyManagerOptions {
  config?: boolean | HotkeyConfig;
  session?: RecordingSession;
  onStartRequest?: () => Promise<RecordingSession> | void;
  onStopRequest?: () => Promise<any> | void;
  onDiscardRequest?: () => Promise<void> | void;
}

/**
 * Manages global keyboard shortcuts for the ShowAndTell SDK.
 */
export class HotkeyManager {
  private config: HotkeyConfig;
  private session?: RecordingSession;
  private onStartRequest?: () => Promise<RecordingSession> | void;
  private onStopRequest?: () => Promise<any> | void;
  private onDiscardRequest?: () => Promise<void> | void;

  private target?: EventTarget;
  private isListening = false;

  private parsedToggleRecording: ParsedHotkey | null = null;
  private parsedTogglePause: ParsedHotkey | null = null;
  private parsedToggleMic: ParsedHotkey | null = null;
  private parsedToggleCamera: ParsedHotkey | null = null;
  private parsedToggleSpotlight: ParsedHotkey | null = null;
  private parsedDiscardRecording: ParsedHotkey | null = null;

  constructor(options: HotkeyManagerOptions = {}) {
    const userConfig = typeof options.config === 'object' ? options.config : {};
    this.config = {
      ...DEFAULT_HOTKEYS,
      ...userConfig
    };
    this.session = options.session;
    this.onStartRequest = options.onStartRequest;
    this.onStopRequest = options.onStopRequest;
    this.onDiscardRequest = options.onDiscardRequest;

    this.reparseHotkeys();
  }

  public setSession(session?: RecordingSession): void {
    this.session = session;
  }

  public updateConfig(config?: boolean | HotkeyConfig): void {
    if (config === false) {
      this.config.enabled = false;
    } else {
      const userConfig = typeof config === 'object' ? config : {};
      this.config = {
        ...this.config,
        ...userConfig,
        enabled: userConfig.enabled ?? true
      };
    }
    this.reparseHotkeys();
  }

  public getConfig(): HotkeyConfig {
    return { ...this.config };
  }

  private reparseHotkeys(): void {
    this.parsedToggleRecording = this.config.toggleRecording ? parseHotkey(this.config.toggleRecording) : null;
    this.parsedTogglePause = this.config.togglePause ? parseHotkey(this.config.togglePause) : null;
    this.parsedToggleMic = this.config.toggleMic ? parseHotkey(this.config.toggleMic) : null;
    this.parsedToggleCamera = this.config.toggleCamera ? parseHotkey(this.config.toggleCamera) : null;
    this.parsedToggleSpotlight = this.config.toggleSpotlight ? parseHotkey(this.config.toggleSpotlight) : null;
    this.parsedDiscardRecording = this.config.discardRecording ? parseHotkey(this.config.discardRecording) : null;
  }

  public mount(target?: EventTarget): void {
    if (this.isListening) return;
    if (this.config.enabled === false) return;

    this.target = target || this.config.target || (typeof window !== 'undefined' ? window : undefined);
    if (!this.target) return;

    this.target.addEventListener('keydown', this.handleKeyDown as EventListener, { capture: true });
    this.isListening = true;
  }

  public destroy(): void {
    if (!this.isListening || !this.target) return;
    this.target.removeEventListener('keydown', this.handleKeyDown as EventListener, { capture: true });
    this.isListening = false;
    this.target = undefined;
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.config.enabled === false) return;

    // Check collision with text inputs / contenteditable
    if (this.config.preventInputCollision !== false && isEditableElement(event.target)) {
      return;
    }

    const session = this.session;
    const isSessionActive = session && (session.state === 'recording' || session.state === 'paused');

    // 1. Toggle Recording (Start/Stop)
    if (this.parsedToggleRecording && matchesHotkey(event, this.parsedToggleRecording)) {
      event.preventDefault();
      event.stopPropagation();

      if (isSessionActive) {
        if (this.onStopRequest) {
          this.onStopRequest();
        } else {
          session?.stop().catch((err) => console.error('[ShowAndTell Hotkeys] Failed to stop recording:', err));
        }
      } else if (this.onStartRequest) {
        this.onStartRequest();
      }
      return;
    }

    // Following hotkeys only apply when a recording session is active
    if (!isSessionActive || !session) {
      return;
    }

    // 2. Toggle Pause / Resume
    if (this.parsedTogglePause && matchesHotkey(event, this.parsedTogglePause)) {
      event.preventDefault();
      event.stopPropagation();
      if (session.state === 'recording') {
        session.pause();
      } else if (session.state === 'paused') {
        session.resume();
      }
      return;
    }

    // 3. Toggle Mic
    if (this.parsedToggleMic && matchesHotkey(event, this.parsedToggleMic)) {
      event.preventDefault();
      event.stopPropagation();
      session.toggleMic();
      return;
    }

    // 4. Toggle Camera Bubble
    if (this.parsedToggleCamera && matchesHotkey(event, this.parsedToggleCamera)) {
      event.preventDefault();
      event.stopPropagation();
      session.toggleCamera?.();
      return;
    }

    // 5. Toggle Spotlight
    if (this.parsedToggleSpotlight && matchesHotkey(event, this.parsedToggleSpotlight)) {
      event.preventDefault();
      event.stopPropagation();
      session.toggleSpotlight();
      return;
    }

    // 6. Discard Recording
    if (this.parsedDiscardRecording && matchesHotkey(event, this.parsedDiscardRecording)) {
      event.preventDefault();
      event.stopPropagation();
      if (this.onDiscardRequest) {
        this.onDiscardRequest();
      } else {
        session.discard().catch((err) => console.error('[ShowAndTell Hotkeys] Failed to discard session:', err));
      }
      return;
    }
  };
}
