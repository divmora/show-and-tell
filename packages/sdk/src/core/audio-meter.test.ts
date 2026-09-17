import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioLevelMeter } from './audio-meter';

function createMockMicStream(): MediaStream {
  const track = {
    kind: 'audio',
    enabled: true,
    stop: vi.fn()
  };
  return {
    getAudioTracks: () => [track],
    getTracks: () => [track]
  } as unknown as MediaStream;
}

function createMockAudioContext(mockWaveform?: number[]) {
  const data = mockWaveform || new Array(256).fill(128); // 128 is center/silence
  const analyserNode = {
    fftSize: 256,
    smoothingTimeConstant: 0.3,
    getByteTimeDomainData: vi.fn((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = data[i % data.length];
      }
    }),
    connect: vi.fn(),
    disconnect: vi.fn()
  };

  const micSourceNode = {
    connect: vi.fn(),
    disconnect: vi.fn()
  };

  const audioContext = {
    state: 'running',
    createMediaStreamSource: vi.fn(() => micSourceNode),
    createAnalyser: vi.fn(() => analyserNode),
    close: vi.fn().mockResolvedValue(undefined)
  };

  return { audioContext, analyserNode, micSourceNode };
}

describe('AudioLevelMeter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('handles missing Web Audio API without throwing and returns silence', () => {
    const origAudioContext = (window as any).AudioContext;
    delete (window as any).AudioContext;

    try {
      const stream = createMockMicStream();
      const meter = new AudioLevelMeter(stream);

      const level = meter.getLevel();
      expect(level).toEqual({ volume: 0, level: 0 });
      expect(meter.isSilentWarning()).toBe(false);

      meter.destroy();
    } finally {
      (window as any).AudioContext = origAudioContext;
    }
  });

  it('initializes analyser node and computes audio level from waveform', () => {
    // Alternating between 128 - 40 and 128 + 40 (amplitude 40/128 ≈ 0.31)
    const wave = new Array(256).fill(0).map((_, i) => (i % 2 === 0 ? 88 : 168));
    const { audioContext, analyserNode, micSourceNode } = createMockAudioContext(wave);

    const stream = createMockMicStream();
    const onLevel = vi.fn();
    const meter = new AudioLevelMeter(stream, { onLevel }, audioContext as any);

    expect(audioContext.createMediaStreamSource).toHaveBeenCalledWith(stream);
    expect(audioContext.createAnalyser).toHaveBeenCalled();
    expect(micSourceNode.connect).toHaveBeenCalledWith(analyserNode);

    // Advance 1 tick (50ms)
    vi.advanceTimersByTime(50);

    expect(analyserNode.getByteTimeDomainData).toHaveBeenCalled();
    expect(onLevel).toHaveBeenCalled();
    const lastCall = onLevel.mock.calls[onLevel.mock.calls.length - 1][0];
    expect(lastCall.volume).toBeGreaterThan(0.2);
    expect(lastCall.level).toBeGreaterThanOrEqual(2);

    meter.destroy();
  });

  it('discretizes different volume ranges: silence, low, medium, peak', () => {
    // 1. Silent wave (flat 128)
    const silentWave = new Array(256).fill(128);
    const mockSilent = createMockAudioContext(silentWave);
    const meterSilent = new AudioLevelMeter(createMockMicStream(), {}, mockSilent.audioContext as any);
    vi.advanceTimersByTime(50);
    expect(meterSilent.getLevel()).toEqual({ volume: 0, level: 0 });
    meterSilent.destroy();

    // 2. Low wave (small amplitude +/- 3)
    const lowWave = new Array(256).fill(0).map((_, i) => (i % 2 === 0 ? 125 : 131));
    const mockLow = createMockAudioContext(lowWave);
    const meterLow = new AudioLevelMeter(createMockMicStream(), {}, mockLow.audioContext as any);
    vi.advanceTimersByTime(50);
    expect(meterLow.getLevel().level).toBe(1);
    meterLow.destroy();

    // 3. Peak/loud wave (amplitude +/- 90)
    const loudWave = new Array(256).fill(0).map((_, i) => (i % 2 === 0 ? 38 : 218));
    const mockLoud = createMockAudioContext(loudWave);
    const meterLoud = new AudioLevelMeter(createMockMicStream(), {}, mockLoud.audioContext as any);
    vi.advanceTimersByTime(50);
    expect(meterLoud.getLevel().level).toBe(3);
    meterLoud.destroy();
  });

  it('triggers silent mic warning when silence persists for threshold duration', () => {
    const silentWave = new Array(256).fill(128);
    const { audioContext } = createMockAudioContext(silentWave);

    const onSilentWarning = vi.fn();
    const meter = new AudioLevelMeter(
      createMockMicStream(),
      { silentThresholdSeconds: 5, onSilentWarning },
      audioContext as any
    );

    // After 2 seconds of silence, warning should not be active yet
    vi.advanceTimersByTime(2000);
    expect(meter.isSilentWarning()).toBe(false);
    expect(onSilentWarning).not.toHaveBeenCalledWith(true);

    // After reaching 5 seconds of silence, warning triggers
    vi.advanceTimersByTime(3050);
    expect(meter.isSilentWarning()).toBe(true);
    expect(onSilentWarning).toHaveBeenCalledWith(true);

    meter.destroy();
  });

  it('dismisses silent mic warning automatically as soon as sound is detected', () => {
    // Start with silence
    let wave = new Array(256).fill(128);
    const analyserNode = {
      fftSize: 256,
      smoothingTimeConstant: 0.3,
      getByteTimeDomainData: vi.fn((arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = wave[i % wave.length];
        }
      }),
      connect: vi.fn(),
      disconnect: vi.fn()
    };
    const audioContext = {
      state: 'running',
      createMediaStreamSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
      createAnalyser: vi.fn(() => analyserNode),
      close: vi.fn().mockResolvedValue(undefined)
    };

    const onSilentWarning = vi.fn();
    const meter = new AudioLevelMeter(
      createMockMicStream(),
      { silentThresholdSeconds: 3, onSilentWarning },
      audioContext as any
    );

    // Trigger silent warning after 3s
    vi.advanceTimersByTime(3050);
    expect(meter.isSilentWarning()).toBe(true);

    // User now speaks!
    wave = new Array(256).fill(0).map((_, i) => (i % 2 === 0 ? 90 : 166));
    vi.advanceTimersByTime(100);

    expect(meter.isSilentWarning()).toBe(false);
    expect(onSilentWarning).toHaveBeenCalledWith(false);

    meter.destroy();
  });

  it('resets silent warning and zeroes level when mic is muted', () => {
    const silentWave = new Array(256).fill(128);
    const { audioContext } = createMockAudioContext(silentWave);

    const onSilentWarning = vi.fn();
    const meter = new AudioLevelMeter(
      createMockMicStream(),
      { silentThresholdSeconds: 5, onSilentWarning },
      audioContext as any
    );

    // Advance to 5s to trigger silent warning
    vi.advanceTimersByTime(5050);
    expect(meter.isSilentWarning()).toBe(true);

    // User mutes microphone
    meter.setMuted(true);
    expect(meter.isSilentWarning()).toBe(false);
    expect(meter.getLevel()).toEqual({ volume: 0, level: 0 });

    meter.destroy();
  });

  it('does not trigger silent mic warning when silentWarning: false', () => {
    const silentWave = new Array(256).fill(128);
    const { audioContext } = createMockAudioContext(silentWave);

    const onSilentWarning = vi.fn();
    const meter = new AudioLevelMeter(
      createMockMicStream(),
      { silentWarning: false, silentThresholdSeconds: 2, onSilentWarning },
      audioContext as any
    );

    vi.advanceTimersByTime(10000);
    expect(meter.isSilentWarning()).toBe(false);
    expect(onSilentWarning).not.toHaveBeenCalled();

    meter.destroy();
  });

  it('cleans up timer and disconnects nodes on destroy()', () => {
    const { audioContext, analyserNode, micSourceNode } = createMockAudioContext();
    const meter = new AudioLevelMeter(createMockMicStream(), {}, audioContext as any);

    meter.destroy();
    expect(micSourceNode.disconnect).toHaveBeenCalled();
    expect(analyserNode.disconnect).toHaveBeenCalled();

    // Calling destroy again should be a no-op
    expect(() => meter.destroy()).not.toThrow();
  });
});
