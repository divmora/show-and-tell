import { DurationStats } from '../types';
import { EventEmitter } from '../utils/event-emitter';
import { formatDuration, parseDurationToMs } from '../utils/time';

export interface DurationTrackerOptions {
  maxDuration?: number | string;
  warningThreshold?: number; // in seconds (default: 10)
  initialElapsedMs?: number;
}

export type DurationTrackerEvents = {
  tick: [stats: DurationStats];
  warning: [stats: DurationStats];
  timeout: [stats: DurationStats];
};

export class DurationTracker extends EventEmitter<DurationTrackerEvents> {
  private maxDurationMs?: number;
  private warningThresholdSec: number;
  private accumulatedElapsedMs: number = 0;
  private currentSegmentStartTime: number = 0;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private timerIntervalId?: number | NodeJS.Timeout;
  private warningFired: boolean = false;
  private timeoutFired: boolean = false;

  constructor(options: DurationTrackerOptions = {}) {
    super();
    this.maxDurationMs = parseDurationToMs(options.maxDuration);
    this.warningThresholdSec = options.warningThreshold ?? 10;
    this.accumulatedElapsedMs = options.initialElapsedMs ?? 0;
  }

  /**
   * Starts tracking time.
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.currentSegmentStartTime = performance.now();
    this.startInterval();
    this.tick();
  }

  /**
   * Pauses the timer without losing accumulated time.
   */
  pause(): void {
    if (!this.isRunning || this.isPaused) return;
    this.accumulatedElapsedMs += performance.now() - this.currentSegmentStartTime;
    this.isPaused = true;
    this.stopInterval();
    this.tick();
  }

  /**
   * Resumes the timer.
   */
  resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    this.currentSegmentStartTime = performance.now();
    this.isPaused = false;
    this.startInterval();
    this.tick();
  }

  /**
   * Stops tracking time and cleans up timers.
   */
  stop(): DurationStats {
    if (this.isRunning && !this.isPaused) {
      this.accumulatedElapsedMs += performance.now() - this.currentSegmentStartTime;
    }
    this.isRunning = false;
    this.isPaused = false;
    this.stopInterval();
    return this.getStats();
  }

  /**
   * Returns current statistics and countdown information.
   */
  getStats(): DurationStats {
    let currentElapsed = this.accumulatedElapsedMs;
    if (this.isRunning && !this.isPaused) {
      currentElapsed += performance.now() - this.currentSegmentStartTime;
    }

    const elapsedSeconds = Math.floor(currentElapsed / 1000);
    const formattedElapsed = formatDuration(elapsedSeconds);

    let maxDurationMs: number | undefined = this.maxDurationMs;
    let maxDurationSeconds: number | undefined;
    let formattedMaxDuration: string | undefined;
    let remainingMs: number | undefined;
    let remainingSeconds: number | undefined;
    let formattedRemaining: string | undefined;
    let progressRatio: number | undefined;
    let isWarning = false;

    if (maxDurationMs !== undefined && maxDurationMs > 0) {
      maxDurationSeconds = Math.floor(maxDurationMs / 1000);
      formattedMaxDuration = formatDuration(maxDurationSeconds);
      remainingMs = Math.max(0, maxDurationMs - currentElapsed);
      remainingSeconds = Math.ceil(remainingMs / 1000);
      formattedRemaining = formatDuration(remainingSeconds);
      progressRatio = Math.min(1.0, currentElapsed / maxDurationMs);
      isWarning = remainingSeconds <= this.warningThresholdSec && remainingSeconds > 0;
    }

    return {
      elapsedMs: Math.round(currentElapsed),
      elapsedSeconds,
      formattedElapsed,
      maxDurationMs,
      maxDurationSeconds,
      formattedMaxDuration,
      remainingMs,
      remainingSeconds,
      formattedRemaining,
      progressRatio,
      isWarning,
      isPaused: this.isPaused
    };
  }

  private startInterval(): void {
    this.stopInterval();
    this.timerIntervalId = setInterval(() => {
      this.tick();
    }, 100);
  }

  private stopInterval(): void {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId as any);
      this.timerIntervalId = undefined;
    }
  }

  private tick(): void {
    const stats = this.getStats();
    this.emit('tick', stats);

    if (this.maxDurationMs !== undefined) {
      // Check warning threshold
      if (stats.isWarning && !this.warningFired) {
        this.warningFired = true;
        this.emit('warning', stats);
      }

      // Check timeout (max duration reached)
      if (stats.elapsedMs >= this.maxDurationMs && !this.timeoutFired) {
        this.timeoutFired = true;
        this.stopInterval();
        this.emit('timeout', stats);
      }
    }
  }
}
