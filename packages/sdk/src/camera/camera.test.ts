import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CameraBubble } from './bubble';
import { VideoCompositor } from './compositor';

describe('CameraBubble', () => {
  let mockTrack: any;
  let mockStream: any;

  beforeEach(() => {
    mockTrack = {
      kind: 'video',
      enabled: true,
      stop: vi.fn()
    };
    mockStream = {
      getVideoTracks: vi.fn(() => [mockTrack]),
      getTracks: vi.fn(() => [mockTrack])
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('initializes with default settings', () => {
    const bubble = new CameraBubble(mockStream);
    const state = bubble.getBubbleState();

    expect(state.shape).toBe('circle');
    expect(state.size).toBe(160);
    expect(state.isMirrored).toBe(true);
    expect(state.isMuted).toBe(false);
  });

  it('initializes with custom configuration', () => {
    const bubble = new CameraBubble(mockStream, {
      shape: 'rect',
      size: 220,
      mirrored: false
    });
    const state = bubble.getBubbleState();

    expect(state.shape).toBe('rect');
    expect(state.size).toBe(220);
    expect(state.width).toBe(340);
    expect(state.height).toBe(191);
    expect(state.isMirrored).toBe(false);
  });

  it('mounts into DOM with isolated shadow root and cleans up on destroy', () => {
    const bubble = new CameraBubble(mockStream);
    bubble.mount();

    const host = document.querySelector('show-and-tell-camera');
    expect(host).not.toBeNull();
    expect(host?.shadowRoot).not.toBeNull();

    bubble.destroy();
    expect(document.querySelector('show-and-tell-camera')).toBeNull();
  });

  it('notifies onStateChange listener on mount and state modifications', () => {
    const bubble = new CameraBubble(mockStream, { shape: 'rect', size: 160 });
    const stateCallback = vi.fn();
    bubble.onStateChange = stateCallback;

    bubble.mount();
    expect(stateCallback).toHaveBeenCalled();
    const lastCall = stateCallback.mock.calls[stateCallback.mock.calls.length - 1][0];
    expect(lastCall.shape).toBe('rect');
    expect(lastCall.width).toBe(260);
    expect(lastCall.height).toBe(146);
    bubble.destroy();
  });
});

describe('VideoCompositor', () => {
  let screenTrack: any;
  let cameraTrack: any;
  let screenStream: any;
  let cameraStream: any;

  beforeEach(() => {
    screenTrack = {
      kind: 'video',
      getSettings: () => ({ width: 1280, height: 720 }),
      stop: vi.fn()
    };
    cameraTrack = {
      kind: 'video',
      getSettings: () => ({ width: 640, height: 480 }),
      stop: vi.fn()
    };
    screenStream = {
      getVideoTracks: () => [screenTrack],
      getTracks: () => [screenTrack]
    };
    cameraStream = {
      getVideoTracks: () => [cameraTrack],
      getTracks: () => [cameraTrack]
    };
  });

  it('instantiates and cleans up resources on destroy', () => {
    const compositor = new VideoCompositor(
      screenStream,
      cameraStream,
      () => ({
        x: 20,
        y: 20,
        size: 160,
        shape: 'circle',
        isMuted: false,
        isMirrored: true
      })
    );

    expect(compositor).toBeDefined();
    // Test destroy is safe even before start
    compositor.destroy();
  });
});
