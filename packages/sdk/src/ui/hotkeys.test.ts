import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  parseHotkey, 
  matchesHotkey, 
  isEditableElement, 
  formatHotkeyLabel, 
  HotkeyManager, 
  DEFAULT_HOTKEYS 
} from './hotkeys';
import { RecordingSession } from '../types';

describe('Global Keyboard Hotkeys', () => {
  describe('parseHotkey', () => {
    it('parses standard modifier combinations correctly', () => {
      const parsed = parseHotkey('Alt+Shift+R');
      expect(parsed).not.toBeNull();
      expect(parsed?.altKey).toBe(true);
      expect(parsed?.shiftKey).toBe(true);
      expect(parsed?.ctrlKey).toBe(false);
      expect(parsed?.metaKey).toBe(false);
      expect(parsed?.key).toBe('r');
      expect(parsed?.code).toBe('KeyR');
    });

    it('handles Option and Command aliases', () => {
      const parsed = parseHotkey('Option+Cmd+K');
      expect(parsed).not.toBeNull();
      expect(parsed?.altKey).toBe(true);
      expect(parsed?.metaKey).toBe(true);
      expect(parsed?.key).toBe('k');
      expect(parsed?.code).toBe('KeyK');
    });

    it('handles Control alias and digit keys', () => {
      const parsed = parseHotkey('Ctrl+Shift+1');
      expect(parsed).not.toBeNull();
      expect(parsed?.ctrlKey).toBe(true);
      expect(parsed?.shiftKey).toBe(true);
      expect(parsed?.key).toBe('1');
      expect(parsed?.code).toBe('Digit1');
    });

    it('handles Escape, Enter, and Space special keys', () => {
      const esc = parseHotkey('Escape');
      expect(esc?.key).toBe('escape');
      expect(esc?.code).toBe('Escape');

      const enter = parseHotkey('Ctrl+Enter');
      expect(enter?.ctrlKey).toBe(true);
      expect(enter?.key).toBe('enter');

      const space = parseHotkey('Alt+Space');
      expect(space?.altKey).toBe(true);
      expect(space?.key).toBe(' ');
    });

    it('returns null for empty or invalid strings', () => {
      expect(parseHotkey('')).toBeNull();
      expect(parseHotkey('  ')).toBeNull();
      expect(parseHotkey('Alt+Shift')).toBeNull(); // Only modifiers without key
    });
  });

  describe('matchesHotkey', () => {
    const hotkey = parseHotkey('Alt+Shift+R')!;

    it('matches exact event modifiers and key', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'r',
        code: 'KeyR',
        altKey: true,
        shiftKey: true
      });
      expect(matchesHotkey(event, hotkey)).toBe(true);
    });

    it('rejects events missing a required modifier', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'r',
        code: 'KeyR',
        altKey: false,
        shiftKey: true
      });
      expect(matchesHotkey(event, hotkey)).toBe(false);
    });

    it('rejects events with extra unexpected modifiers', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'r',
        code: 'KeyR',
        altKey: true,
        shiftKey: true,
        ctrlKey: true
      });
      expect(matchesHotkey(event, hotkey)).toBe(false);
    });

    it('matches macOS Option+R where event.key produces a special glyph (®)', () => {
      const event = new KeyboardEvent('keydown', {
        key: '®',
        code: 'KeyR',
        altKey: true,
        shiftKey: true
      });
      expect(matchesHotkey(event, hotkey)).toBe(true);
    });
  });

  describe('isEditableElement', () => {
    it('identifies input elements as editable', () => {
      const input = document.createElement('input');
      input.type = 'text';
      expect(isEditableElement(input)).toBe(true);

      const emailInput = document.createElement('input');
      emailInput.type = 'email';
      expect(isEditableElement(emailInput)).toBe(true);
    });

    it('treats checkboxes and buttons as non-editable', () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      expect(isEditableElement(checkbox)).toBe(false);

      const btn = document.createElement('button');
      expect(isEditableElement(btn)).toBe(false);
    });

    it('identifies textarea and select as editable', () => {
      const textarea = document.createElement('textarea');
      expect(isEditableElement(textarea)).toBe(true);

      const select = document.createElement('select');
      expect(isEditableElement(select)).toBe(true);
    });

    it('identifies contenteditable elements', () => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      expect(isEditableElement(div)).toBe(true);
    });

    it('returns false for null or standard div', () => {
      expect(isEditableElement(null)).toBe(false);
      const div = document.createElement('div');
      expect(isEditableElement(div)).toBe(false);
    });
  });

  describe('formatHotkeyLabel', () => {
    it('formats combinations into readable text', () => {
      const label = formatHotkeyLabel('Alt+Shift+R');
      expect(label).toBeTruthy();
      expect(label.length).toBeGreaterThan(0);
    });

    it('returns empty string for empty input', () => {
      expect(formatHotkeyLabel('')).toBe('');
    });
  });

  describe('HotkeyManager execution', () => {
    let mockSession: Partial<RecordingSession>;
    let target: HTMLElement;

    beforeEach(() => {
      target = document.createElement('div');
      document.body.appendChild(target);

      mockSession = {
        state: 'recording',
        stop: vi.fn().mockResolvedValue({}),
        pause: vi.fn(),
        resume: vi.fn(),
        toggleMic: vi.fn().mockReturnValue(true),
        toggleSpotlight: vi.fn().mockReturnValue(true),
        toggleCamera: vi.fn().mockReturnValue(true),
        toggleTelestrator: vi.fn().mockReturnValue(true),
        clearDrawings: vi.fn(),
        discard: vi.fn().mockResolvedValue(undefined)
      };
    });

    afterEach(() => {
      if (target.parentNode) {
        target.parentNode.removeChild(target);
      }
      vi.restoreAllMocks();
    });

    it('triggers pause and resume on Alt+Shift+P', () => {
      const manager = new HotkeyManager({
        config: { target },
        session: mockSession as RecordingSession
      });
      manager.mount();

      // When recording -> pause
      const pauseEvent = new KeyboardEvent('keydown', {
        key: 'p',
        code: 'KeyP',
        altKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true
      });
      target.dispatchEvent(pauseEvent);
      expect(mockSession.pause).toHaveBeenCalledTimes(1);

      // Change to paused -> resume
      (mockSession as any).state = 'paused';
      const resumeEvent = new KeyboardEvent('keydown', {
        key: 'p',
        code: 'KeyP',
        altKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true
      });
      target.dispatchEvent(resumeEvent);
      expect(mockSession.resume).toHaveBeenCalledTimes(1);

      manager.destroy();
    });

    it('triggers mic, spotlight, and camera toggles', () => {
      const manager = new HotkeyManager({
        config: { target },
        session: mockSession as RecordingSession
      });
      manager.mount();

      // Toggle Mic (Alt+Shift+M)
      target.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'm',
        code: 'KeyM',
        altKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true
      }));
      expect(mockSession.toggleMic).toHaveBeenCalledTimes(1);

      // Toggle Spotlight (Alt+Shift+S)
      target.dispatchEvent(new KeyboardEvent('keydown', {
        key: 's',
        code: 'KeyS',
        altKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true
      }));
      expect(mockSession.toggleSpotlight).toHaveBeenCalledTimes(1);

      // Toggle Camera (Alt+Shift+C)
      target.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'c',
        code: 'KeyC',
        altKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true
      }));
      expect(mockSession.toggleCamera).toHaveBeenCalledTimes(1);

      // Toggle Telestrator (Alt+Shift+A)
      target.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'a',
        code: 'KeyA',
        altKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true
      }));
      expect(mockSession.toggleTelestrator).toHaveBeenCalledTimes(1);

      // Clear Drawings (Alt+Shift+X)
      target.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'x',
        code: 'KeyX',
        altKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true
      }));
      expect(mockSession.clearDrawings).toHaveBeenCalledTimes(1);

      manager.destroy();
    });

    it('triggers discard on Alt+Shift+D', () => {
      const manager = new HotkeyManager({
        config: { target },
        session: mockSession as RecordingSession
      });
      manager.mount();

      target.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'd',
        code: 'KeyD',
        altKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true
      }));
      expect(mockSession.discard).toHaveBeenCalledTimes(1);

      manager.destroy();
    });

    it('triggers start and stop on toggleRecording (Alt+Shift+R)', () => {
      const onStartRequest = vi.fn();
      const onStopRequest = vi.fn();

      // Idle state
      (mockSession as any).state = 'idle';
      const manager = new HotkeyManager({
        config: { target },
        session: mockSession as RecordingSession,
        onStartRequest,
        onStopRequest
      });
      manager.mount();

      target.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'r',
        code: 'KeyR',
        altKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true
      }));
      expect(onStartRequest).toHaveBeenCalledTimes(1);

      // Active state
      (mockSession as any).state = 'recording';
      target.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'r',
        code: 'KeyR',
        altKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true
      }));
      expect(onStopRequest).toHaveBeenCalledTimes(1);

      manager.destroy();
    });

    it('guards against input collisions when focused on text inputs', () => {
      const manager = new HotkeyManager({
        config: { target, preventInputCollision: true },
        session: mockSession as RecordingSession
      });
      manager.mount();

      const input = document.createElement('input');
      target.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        key: 'p',
        code: 'KeyP',
        altKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true
      });
      Object.defineProperty(event, 'target', { value: input, writable: false });

      target.dispatchEvent(event);
      expect(mockSession.pause).not.toHaveBeenCalled();

      manager.destroy();
    });

    it('bypasses input collision check when preventInputCollision is false', () => {
      const manager = new HotkeyManager({
        config: { target, preventInputCollision: false },
        session: mockSession as RecordingSession
      });
      manager.mount();

      const input = document.createElement('input');
      target.appendChild(input);

      const event = new KeyboardEvent('keydown', {
        key: 'p',
        code: 'KeyP',
        altKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true
      });
      Object.defineProperty(event, 'target', { value: input, writable: false });

      target.dispatchEvent(event);
      expect(mockSession.pause).toHaveBeenCalledTimes(1);

      manager.destroy();
    });

    it('does not fire shortcuts when enabled is false', () => {
      const manager = new HotkeyManager({
        config: { target, enabled: false },
        session: mockSession as RecordingSession
      });
      manager.mount();

      target.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'p',
        code: 'KeyP',
        altKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true
      }));
      expect(mockSession.pause).not.toHaveBeenCalled();

      manager.destroy();
    });
  });
});
