import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trimDomRecording, trimPixelRecording, trimRecordingResult } from './trimmer';
import { RecordingResult, DomRecordingEvent, DiagnosticEntry } from '../types';

function createMockDomResult(durationSec = 60): RecordingResult {
  const events: DomRecordingEvent[] = [
    {
      type: 'dom_snapshot',
      timestamp: 0,
      data: { id: 1, type: 'element', tagName: 'HTML', children: [] },
      viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 }
    },
    {
      type: 'mouse_move',
      timestamp: 3000,
      x: 100,
      y: 100
    },
    {
      type: 'mouse_click',
      timestamp: 15000,
      x: 200,
      y: 200,
      button: 0
    },
    {
      type: 'mouse_move',
      timestamp: 35000,
      x: 300,
      y: 300
    },
    {
      type: 'mouse_click',
      timestamp: 55000,
      x: 400,
      y: 400,
      button: 0
    }
  ];

  const diagnostics: DiagnosticEntry[] = [
    {
      id: 'diag-1',
      category: 'console',
      level: 'error',
      timestamp: 2000,
      message: 'Early error'
    },
    {
      id: 'diag-2',
      category: 'network',
      level: 'warn',
      timestamp: 25000,
      message: 'Mid recording warning'
    },
    {
      id: 'diag-3',
      category: 'console',
      level: 'error',
      timestamp: 58000,
      message: 'Late error'
    }
  ];

  const blob = new Blob([JSON.stringify(events)], { type: 'application/json' });
  const result: RecordingResult = {
    id: 'test-dom-session',
    mode: 'dom',
    blob,
    url: 'blob:test-dom',
    duration: durationSec,
    mimeType: 'application/json',
    filename: 'test-dom.json',
    size: blob.size,
    discontinueReason: 'user-stop',
    domEvents: events,
    diagnostics,
    download: vi.fn(),
    upload: vi.fn(),
    uploadPresigned: vi.fn(),
    revoke: vi.fn()
  };

  return result;
}

function createMockPixelResult(durationSec = 60): RecordingResult {
  const diagnostics: DiagnosticEntry[] = [
    {
      id: 'diag-1',
      category: 'console',
      level: 'error',
      timestamp: 2000,
      message: 'Early error'
    },
    {
      id: 'diag-2',
      category: 'network',
      level: 'warn',
      timestamp: 25000,
      message: 'Mid recording warning'
    },
    {
      id: 'diag-3',
      category: 'console',
      level: 'error',
      timestamp: 58000,
      message: 'Late error'
    }
  ];

  const blob = new Blob(['mock-video-bytes-data'], { type: 'video/webm' });
  const result: RecordingResult = {
    id: 'test-pixel-session',
    mode: 'pixel',
    blob,
    url: 'blob:test-pixel',
    duration: durationSec,
    mimeType: 'video/webm',
    filename: 'test-pixel.webm',
    size: blob.size,
    discontinueReason: 'user-stop',
    diagnostics,
    download: vi.fn(),
    upload: vi.fn(),
    uploadPresigned: vi.fn(),
    revoke: vi.fn()
  };

  return result;
}

describe('Trimmer Subsystem', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('trimDomRecording', () => {
    it('accurately trims DOM events and shifts event timestamps', () => {
      const original = createMockDomResult(60);
      // Trim: in = 10s, out = 40s (30s duration)
      const trimmed = trimDomRecording(original, { inSeconds: 10, outSeconds: 40 });

      expect(trimmed.duration).toBe(30);
      expect(trimmed.trimRange).toEqual({ inSeconds: 10, outSeconds: 40 });
      expect(trimmed.originalDuration).toBe(60);
      expect(trimmed.filename).toBe('test-dom-trimmed.json');

      const events = trimmed.domEvents || [];
      // 1 snapshot + event at 15s (shifted to 5s) + event at 35s (shifted to 25s)
      expect(events.length).toBe(3);

      expect(events[0].type).toBe('dom_snapshot');
      expect(events[0].timestamp).toBe(0);

      expect(events[1].type).toBe('mouse_click');
      expect(events[1].timestamp).toBe(5000); // 15000 - 10000

      expect(events[2].type).toBe('mouse_move');
      expect(events[2].timestamp).toBe(25000); // 35000 - 10000
    });

    it('filters and shifts diagnostic breadcrumbs within the trim window', () => {
      const original = createMockDomResult(60);
      // Trim from 10s to 40s: diag-1 (2s) and diag-3 (58s) excluded, diag-2 (25s) kept and shifted
      const trimmed = trimDomRecording(original, { inSeconds: 10, outSeconds: 40 });

      expect(trimmed.diagnostics?.length).toBe(1);
      expect(trimmed.diagnostics?.[0].id).toBe('diag-2');
      expect(trimmed.diagnostics?.[0].timestamp).toBe(15000); // 25000 - 10000
    });

    it('handles out of bounds clamps safely', () => {
      const original = createMockDomResult(30);
      // Attempt negative inSeconds and excessive outSeconds
      const trimmed = trimDomRecording(original, { inSeconds: -10, outSeconds: 100 });

      expect(trimmed.trimRange?.inSeconds).toBe(0);
      expect(trimmed.trimRange?.outSeconds).toBe(30);
      expect(trimmed.duration).toBe(30);
    });

    it('supports chained trim operations via result.trim()', async () => {
      const original = createMockDomResult(60);
      const trimmed = trimDomRecording(original, { inSeconds: 10, outSeconds: 50 });

      expect(trimmed.trim).toBeDefined();
      const doubleTrimmed = await trimmed.trim!(5, 25);
      expect(doubleTrimmed.duration).toBe(20);
      expect(doubleTrimmed.originalDuration).toBe(60);
    });
  });

  describe('trimPixelRecording', () => {
    it('trims pixel recording and adjusts duration and metadata', async () => {
      const original = createMockPixelResult(60);
      const trimmed = await trimPixelRecording(original, { inSeconds: 5, outSeconds: 25 });

      expect(trimmed.duration).toBe(20);
      expect(trimmed.trimRange).toEqual({ inSeconds: 5, outSeconds: 25 });
      expect(trimmed.originalDuration).toBe(60);
      expect(trimmed.filename).toBe('test-pixel-trimmed.webm');
      expect(trimmed.blob).toBeDefined();
      expect(trimmed.url).toBeDefined();
    });

    it('filters diagnostics within the trim window for pixel recording', async () => {
      const original = createMockPixelResult(60);
      const trimmed = await trimPixelRecording(original, { inSeconds: 20, outSeconds: 50 });

      expect(trimmed.diagnostics?.length).toBe(1);
      expect(trimmed.diagnostics?.[0].id).toBe('diag-2');
      expect(trimmed.diagnostics?.[0].timestamp).toBe(5000); // 25000 - 20000
    });
  });

  describe('trimRecordingResult router', () => {
    it('routes dom recording to trimDomRecording', async () => {
      const dom = createMockDomResult(50);
      const trimmed = await trimRecordingResult(dom, { inSeconds: 5, outSeconds: 30 });
      expect(trimmed.mode).toBe('dom');
      expect(trimmed.duration).toBe(25);
      expect(trimmed.domEvents).toBeDefined();
    });

    it('routes pixel recording to trimPixelRecording', async () => {
      const pixel = createMockPixelResult(40);
      const trimmed = await trimRecordingResult(pixel, { inSeconds: 10, outSeconds: 35 });
      expect(trimmed.mode).toBe('pixel');
      expect(trimmed.duration).toBe(25);
    });
  });
});
