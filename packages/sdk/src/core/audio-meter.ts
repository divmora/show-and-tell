import { AudioLevelData, AudioMeterConfig } from '../types';
import { EventEmitter } from '../utils/event-emitter';

export interface AudioMeterOptions extends AudioMeterConfig {
  silenceThreshold?: number;
  onLevel?: (data: AudioLevelData) => void;
  onSilentWarning?: (warningActive: boolean) => void;
}

export class AudioLevelMeter extends EventEmitter<{
  audioLevel: [AudioLevelData];
  silentMicWarning: [boolean];
}> {
  private audioContext?: AudioContext;
  private ownContext = false;
  private micSourceNode?: MediaStreamAudioSourceNode;
  private analyserNode?: AnalyserNode;
  private dataArray?: Uint8Array;
  private intervalId?: any;

  private isMuted = false;
  private isPaused = false;
  private isDestroyed = false;
  private isSupported = false;

  private currentVolume = 0;
  private currentLevel: 0 | 1 | 2 | 3 = 0;

  private silentMs = 0;
  private silentThresholdMs: number;
  private silentWarningActive = false;

  constructor(
    private micStream: MediaStream,
    private options: AudioMeterOptions = {},
    existingContext?: AudioContext
  ) {
    super();
    const thresholdSec = options.silentThresholdSeconds ?? 5;
    this.silentThresholdMs = Math.max(1, thresholdSec) * 1000;

    this.initAudioContext(existingContext);
    this.startSampling();
  }

  private initAudioContext(existingContext?: AudioContext): void {
    if (typeof window === 'undefined') return;

    try {
      if (existingContext && existingContext.state !== 'closed') {
        this.audioContext = existingContext;
        this.ownContext = false;
      } else {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        this.audioContext = new AudioCtx();
        this.ownContext = true;
      }

      this.micSourceNode = this.audioContext.createMediaStreamSource(this.micStream);
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.3;

      this.micSourceNode.connect(this.analyserNode);
      this.dataArray = new Uint8Array(this.analyserNode.fftSize);
      this.isSupported = true;
    } catch (err) {
      // AudioContext unavailable or denied in browser/test
      this.isSupported = false;
    }
  }

  private startSampling(): void {
    const intervalMs = 50; // 20 updates per second
    this.intervalId = setInterval(() => {
      this.tick(intervalMs);
    }, intervalMs);
  }

  private tick(intervalMs: number): void {
    if (this.isDestroyed) return;

    if (!this.isSupported || this.isPaused || this.isMuted) {
      this.currentVolume = 0;
      this.currentLevel = 0;

      if (this.isMuted) {
        this.silentMs = 0;
        if (this.silentWarningActive) {
          this.silentWarningActive = false;
          this.emit('silentMicWarning', false);
          this.options.onSilentWarning?.(false);
        }
      }

      const data: AudioLevelData = { volume: 0, level: 0 };
      this.emit('audioLevel', data);
      this.options.onLevel?.(data);
      return;
    }

    if (!this.analyserNode || !this.dataArray) return;

    // Read byte time-domain waveform
    this.analyserNode.getByteTimeDomainData(this.dataArray as any);

    let sumSquares = 0;
    const len = this.dataArray.length;
    for (let i = 0; i < len; i++) {
      const norm = (this.dataArray[i] - 128) / 128;
      sumSquares += norm * norm;
    }

    const rms = Math.sqrt(sumSquares / len);
    // Multiply by sensitivity gain and clamp between 0.0 and 1.0
    const volume = Math.min(1.0, Math.round(rms * 5.5 * 100) / 100);
    this.currentVolume = volume;

    // Discretize into 3-segment VU meter tiers
    let level: 0 | 1 | 2 | 3 = 0;
    if (volume >= 0.58) {
      level = 3; // Loud / Peak (red)
    } else if (volume >= 0.22) {
      level = 2; // Normal speaking (yellow/amber)
    } else if (volume >= 0.03) {
      level = 1; // Low / Ambient (green)
    } else {
      level = 0; // Silence
    }
    this.currentLevel = level;

    // Silent mic detection logic
    if (this.options.silentWarning !== false) {
      if (level === 0) {
        this.silentMs += intervalMs;
        if (this.silentMs >= this.silentThresholdMs) {
          if (!this.silentWarningActive) {
            this.silentWarningActive = true;
            this.emit('silentMicWarning', true);
            this.options.onSilentWarning?.(true);
          }
        }
      } else {
        // Audio activity detected: reset silent timer
        this.silentMs = 0;
        if (this.silentWarningActive) {
          this.silentWarningActive = false;
          this.emit('silentMicWarning', false);
          this.options.onSilentWarning?.(false);
        }
      }
    }

    const levelData: AudioLevelData = { volume, level };
    this.emit('audioLevel', levelData);
    this.options.onLevel?.(levelData);
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.silentMs = 0;
      if (this.silentWarningActive) {
        this.silentWarningActive = false;
        this.emit('silentMicWarning', false);
        this.options.onSilentWarning?.(false);
      }
      this.currentVolume = 0;
      this.currentLevel = 0;
      const data: AudioLevelData = { volume: 0, level: 0 };
      this.emit('audioLevel', data);
      this.options.onLevel?.(data);
    }
  }

  setPaused(paused: boolean): void {
    this.isPaused = paused;
    if (paused) {
      this.currentVolume = 0;
      this.currentLevel = 0;
      const data: AudioLevelData = { volume: 0, level: 0 };
      this.emit('audioLevel', data);
      this.options.onLevel?.(data);
    }
  }

  getLevel(): AudioLevelData {
    return {
      volume: this.currentVolume,
      level: this.currentLevel
    };
  }

  isSilentWarning(): boolean {
    return this.silentWarningActive;
  }

  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    if (this.micSourceNode) {
      try {
        this.micSourceNode.disconnect();
      } catch {}
      this.micSourceNode = undefined;
    }

    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch {}
      this.analyserNode = undefined;
    }

    if (this.ownContext && this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = undefined;
    }

    this.removeAllListeners();
  }
}
