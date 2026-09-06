import { describe, it, expect } from 'vitest';
import { formatBytes, formatDuration, parseDurationToMs } from './time';

describe('Time Utilities', () => {
  describe('parseDurationToMs', () => {
    it('parses numeric values in seconds', () => {
      expect(parseDurationToMs(30)).toBe(30000);
      expect(parseDurationToMs(120)).toBe(120000);
      expect(parseDurationToMs(0.5)).toBe(500);
    });

    it('parses duration strings with units', () => {
      expect(parseDurationToMs('30s')).toBe(30000);
      expect(parseDurationToMs('10sec')).toBe(10000);
      expect(parseDurationToMs('2m')).toBe(120000);
      expect(parseDurationToMs('1.5min')).toBe(90000);
      expect(parseDurationToMs('1h')).toBe(3600000);
      expect(parseDurationToMs('500ms')).toBe(500);
    });

    it('handles undefined or invalid inputs', () => {
      expect(parseDurationToMs(undefined)).toBeUndefined();
      expect(parseDurationToMs('')).toBeUndefined();
      expect(parseDurationToMs('invalid')).toBeUndefined();
      expect(parseDurationToMs(-10)).toBeUndefined();
    });
  });

  describe('formatDuration', () => {
    it('formats seconds into MM:SS', () => {
      expect(formatDuration(0)).toBe('00:00');
      expect(formatDuration(9)).toBe('00:09');
      expect(formatDuration(65)).toBe('01:05');
      expect(formatDuration(599)).toBe('09:59');
    });

    it('formats long durations into HH:MM:SS', () => {
      expect(formatDuration(3600)).toBe('01:00:00');
      expect(formatDuration(3665)).toBe('01:01:05');
    });

    it('handles Infinity or NaN gracefully without producing Infinity:NaN:NaN', () => {
      expect(formatDuration(Infinity)).toBe('00:00');
      expect(formatDuration(-Infinity)).toBe('00:00');
      expect(formatDuration(NaN)).toBe('00:00');
    });
  });

  describe('formatBytes', () => {
    it('formats byte sizes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });
  });
});
