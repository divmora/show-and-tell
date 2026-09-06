import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DurationTracker } from './duration-tracker';

describe('DurationTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tracks elapsed time accurately without maxDuration', () => {
    const tracker = new DurationTracker();
    tracker.start();

    vi.advanceTimersByTime(2500);

    const stats = tracker.getStats();
    expect(stats.elapsedSeconds).toBe(2);
    expect(stats.formattedElapsed).toBe('00:02');
    expect(stats.maxDurationSeconds).toBeUndefined();
    expect(stats.isPaused).toBe(false);

    tracker.stop();
  });

  it('handles pause and resume without counting paused duration', () => {
    const tracker = new DurationTracker();
    tracker.start();

    // 3 seconds active
    vi.advanceTimersByTime(3000);

    // Pause for 5 seconds
    tracker.pause();
    vi.advanceTimersByTime(5000);

    let stats = tracker.getStats();
    expect(stats.elapsedSeconds).toBe(3);
    expect(stats.isPaused).toBe(true);

    // Resume for 2 seconds
    tracker.resume();
    vi.advanceTimersByTime(2000);

    stats = tracker.getStats();
    expect(stats.elapsedSeconds).toBe(5);
    expect(stats.formattedElapsed).toBe('00:05');
    expect(stats.isPaused).toBe(false);

    tracker.stop();
  });

  it('calculates countdown and triggers warning when approaching maxDuration', () => {
    const warningHandler = vi.fn();
    const tracker = new DurationTracker({
      maxDuration: 15, // 15 seconds
      warningThreshold: 5 // Warning at 5s remaining
    });

    tracker.on('warning', warningHandler);
    tracker.start();

    // Advance 8 seconds (7s remaining, not warning yet)
    vi.advanceTimersByTime(8000);
    expect(tracker.getStats().isWarning).toBe(false);
    expect(warningHandler).not.toHaveBeenCalled();

    // Advance 3 more seconds (11s elapsed, 4s remaining -> warning triggers!)
    vi.advanceTimersByTime(3000);
    const stats = tracker.getStats();
    expect(stats.isWarning).toBe(true);
    expect(stats.remainingSeconds).toBe(4);
    expect(stats.formattedRemaining).toBe('00:04');
    expect(stats.formattedMaxDuration).toBe('00:15');
    expect(warningHandler).toHaveBeenCalledTimes(1);

    tracker.stop();
  });

  it('triggers timeout when maxDuration is reached', () => {
    const timeoutHandler = vi.fn();
    const tracker = new DurationTracker({
      maxDuration: '10s'
    });

    tracker.on('timeout', timeoutHandler);
    tracker.start();

    // Advance past 10 seconds
    vi.advanceTimersByTime(10100);

    expect(timeoutHandler).toHaveBeenCalledTimes(1);
    const stats = tracker.getStats();
    expect(stats.elapsedSeconds).toBe(10);
    expect(stats.progressRatio).toBe(1.0);

    tracker.stop();
  });
});
