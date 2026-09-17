import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RecorderEngine } from './recorder';

describe('RecorderEngine Capabilities & Mobile Fallback', () => {
  const originalMediaDevices = navigator.mediaDevices;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock-object-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      configurable: true,
      writable: true
    });
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  describe('Capability Checks', () => {
    it('detects when getDisplayMedia is supported', () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getDisplayMedia: vi.fn()
        },
        configurable: true,
        writable: true
      });

      expect(RecorderEngine.isScreenCaptureSupported()).toBe(true);
      expect(RecorderEngine.isSupported('pixel')).toBe(true);
      expect(RecorderEngine.isSupported('auto')).toBe(true);
      expect(RecorderEngine.getSupportedModes()).toContain('pixel');
      expect(RecorderEngine.getSupportedModes()).toContain('dom');
    });

    it('detects when getDisplayMedia is missing (e.g. iPhone Chrome / Safari on iOS)', () => {
      // Simulate iPhone / iOS WebKit where getDisplayMedia is undefined
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn(),
          getDisplayMedia: undefined
        },
        configurable: true,
        writable: true
      });

      expect(RecorderEngine.isScreenCaptureSupported()).toBe(false);
      expect(RecorderEngine.isSupported('pixel')).toBe(false);
      expect(RecorderEngine.isDomRecordingSupported()).toBe(true);
      expect(RecorderEngine.isSupported('dom')).toBe(true);
      // 'auto' is supported because DOM mode is available
      expect(RecorderEngine.isSupported('auto')).toBe(true);
      expect(RecorderEngine.getSupportedModes()).toEqual(['dom']);
    });
  });

  describe('startRecording on mobile / unsupported environments', () => {
    it('throws descriptive error mentioning iOS / iPhone when pixel mode is requested without fallback', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn(),
          getDisplayMedia: undefined
        },
        configurable: true,
        writable: true
      });

      const engine = new RecorderEngine();
      await expect(
        engine.startRecording({ mode: 'pixel' })
      ).rejects.toThrow(/iPhone.*iOS.*dom.*auto/i);
    });

    it('automatically selects DOM mode when mode: "auto" is used on mobile / getDisplayMedia-less browsers', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn(),
          getDisplayMedia: undefined
        },
        configurable: true,
        writable: true
      });

      const engine = new RecorderEngine();
      const session = await engine.startRecording({
        mode: 'auto',
        ui: false
      });

      expect(session).toBeDefined();
      expect(session.state).toBe('recording');

      const result = await session.stop();
      expect(result.mode).toBe('dom');
    });

    it('falls back to DOM mode when fallbackToDom: true is configured', async () => {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn(),
          getDisplayMedia: undefined
        },
        configurable: true,
        writable: true
      });

      const engine = new RecorderEngine();
      const session = await engine.startRecording({
        mode: 'pixel',
        fallbackToDom: true,
        ui: false
      });

      expect(session).toBeDefined();
      expect(session.state).toBe('recording');

      const result = await session.stop();
      expect(result.mode).toBe('dom');
    });
  });
});
