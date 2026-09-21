import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShowAndTell } from './useShowAndTell';
import { ShowAndTell } from '@divmora/show-and-tell';

function createMockSession() {
  const listeners = new Map<string, Function[]>();
  let micMuted = false;

  const session = {
    state: 'recording' as any,
    getStats: vi.fn().mockReturnValue({
      elapsedMs: 5000,
      activeMs: 5000,
      formattedElapsed: '00:05',
      formattedRemaining: undefined,
      progressRatio: undefined,
      isPaused: false,
      isWarning: false
    }),
    isMicMuted: vi.fn(() => micMuted),
    pause: vi.fn(() => {
      session.state = 'paused';
      session.emit('pause');
    }),
    resume: vi.fn(() => {
      session.state = 'recording';
      session.emit('resume');
    }),
    stop: vi.fn().mockImplementation(async () => {
      session.state = 'stopped';
      const result = {
        blob: new Blob(['video']),
        durationMs: 5000,
        formattedDuration: '00:05',
        mimeType: 'video/webm',
        filename: 'recording.webm',
        url: 'blob:test',
        discontinueReason: 'user-stop'
      };
      session.emit('stop', result);
      return result;
    }),
    toggleMic: vi.fn(() => {
      micMuted = !micMuted;
      session.emit('micMuteChange', micMuted);
      return micMuted;
    }),
    muteMic: vi.fn(() => {
      micMuted = true;
      session.emit('micMuteChange', true);
    }),
    unmuteMic: vi.fn(() => {
      micMuted = false;
      session.emit('micMuteChange', false);
    }),
    toggleSpotlight: vi.fn(() => {
      session.emit('spotlightChange', true);
      return true;
    }),
    setSpotlight: vi.fn((enabled: boolean) => {
      session.emit('spotlightChange', enabled);
    }),
    discard: vi.fn().mockImplementation(async () => {
      session.state = 'idle';
      session.emit('discard');
    }),
    toggleCamera: vi.fn(() => {
      session.emit('cameraToggle', true);
      return true;
    }),
    toggleTelestrator: vi.fn(() => {
      session.emit('telestratorToggle', true);
      return true;
    }),
    isTelestratorActive: vi.fn(() => false),
    clearDrawings: vi.fn(),
    setDrawingTool: vi.fn(),
    setDrawingColor: vi.fn(),
    toggleDisappearingInk: vi.fn(() => true),
    isSpotlightActive: vi.fn(() => false),
    triggerClickRipple: vi.fn(),
    on: vi.fn((event: string, handler: Function) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event)!.push(handler);
      return () => {
        const list = listeners.get(event) || [];
        listeners.set(event, list.filter((h) => h !== handler));
      };
    }),
    off: vi.fn(),
    emit: (event: string, ...args: any[]) => {
      const list = listeners.get(event) || [];
      list.forEach((h) => h(...args));
    }
  };

  return session;
}

describe('useShowAndTell', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(ShowAndTell, 'getActiveSession').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with idle default state', () => {
    const { result } = renderHook(() => useShowAndTell());

    expect(result.current.state).toBe('idle');
    expect(result.current.isRecording).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.isActive).toBe(false);
    expect(result.current.formattedElapsed).toBe('00:00');
    expect(result.current.activeSession).toBeNull();
    expect(result.current.lastResult).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('starts recording and binds session events', async () => {
    const mockSession = createMockSession();
    vi.spyOn(ShowAndTell, 'startRecording').mockResolvedValue(mockSession as any);

    const onStart = vi.fn();
    const { result } = renderHook(() => useShowAndTell({ onStart }));

    let session: any;
    await act(async () => {
      session = await result.current.startRecording();
    });

    expect(ShowAndTell.startRecording).toHaveBeenCalled();
    expect(session).toBe(mockSession);
    expect(onStart).toHaveBeenCalledWith(mockSession);
    expect(result.current.state).toBe('recording');
    expect(result.current.isRecording).toBe(true);
    expect(result.current.isActive).toBe(true);
  });

  it('reacts to tick events from active session', async () => {
    const mockSession = createMockSession();
    vi.spyOn(ShowAndTell, 'startRecording').mockResolvedValue(mockSession as any);

    const { result } = renderHook(() => useShowAndTell());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      mockSession.emit('tick', {
        elapsedMs: 12000,
        activeMs: 12000,
        formattedElapsed: '00:12',
        formattedRemaining: '00:48',
        progressRatio: 0.2,
        isPaused: false,
        isWarning: false
      });
    });

    expect(result.current.formattedElapsed).toBe('00:12');
    expect(result.current.formattedRemaining).toBe('00:48');
    expect(result.current.progressRatio).toBe(0.2);
    expect(result.current.isWarning).toBe(false);
  });

  it('handles pause and resume controls and events', async () => {
    const mockSession = createMockSession();
    vi.spyOn(ShowAndTell, 'startRecording').mockResolvedValue(mockSession as any);

    const { result } = renderHook(() => useShowAndTell());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      result.current.pauseRecording();
    });

    expect(mockSession.pause).toHaveBeenCalled();
    expect(result.current.isPaused).toBe(true);
    expect(result.current.state).toBe('paused');

    act(() => {
      result.current.resumeRecording();
    });

    expect(mockSession.resume).toHaveBeenCalled();
    expect(result.current.isPaused).toBe(false);
    expect(result.current.state).toBe('recording');
  });

  it('handles microphone toggle, mute, and unmute', async () => {
    const mockSession = createMockSession();
    vi.spyOn(ShowAndTell, 'startRecording').mockResolvedValue(mockSession as any);

    const { result } = renderHook(() => useShowAndTell());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      result.current.muteMic();
    });

    expect(mockSession.muteMic).toHaveBeenCalled();
    expect(result.current.isMicMuted).toBe(true);

    act(() => {
      result.current.unmuteMic();
    });

    expect(mockSession.unmuteMic).toHaveBeenCalled();
    expect(result.current.isMicMuted).toBe(false);

    act(() => {
      result.current.toggleMic();
    });

    expect(mockSession.toggleMic).toHaveBeenCalled();
    expect(result.current.isMicMuted).toBe(true);
  });

  it('handles cursor spotlight and click ripple controls', async () => {
    const mockSession = createMockSession();
    vi.spyOn(ShowAndTell, 'startRecording').mockResolvedValue(mockSession as any);

    const { result } = renderHook(() => useShowAndTell());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      result.current.toggleSpotlight();
    });

    expect(mockSession.toggleSpotlight).toHaveBeenCalled();
    expect(result.current.isSpotlightActive).toBe(true);

    act(() => {
      result.current.triggerClickRipple(100, 200, '#ff0000');
    });

    expect(mockSession.triggerClickRipple).toHaveBeenCalledWith(100, 200, '#ff0000');
  });

  it('stops recording and saves lastResult', async () => {
    const mockSession = createMockSession();
    vi.spyOn(ShowAndTell, 'startRecording').mockResolvedValue(mockSession as any);

    const onStop = vi.fn();
    const { result } = renderHook(() => useShowAndTell({ onStop }));

    await act(async () => {
      await result.current.startRecording();
    });

    let stopResult: any;
    await act(async () => {
      stopResult = await result.current.stopRecording();
    });

    expect(mockSession.stop).toHaveBeenCalled();
    expect(stopResult.filename).toBe('recording.webm');
    expect(onStop).toHaveBeenCalledWith(stopResult);
    expect(result.current.state).toBe('stopped');
    expect(result.current.activeSession).toBeNull();
    expect(result.current.lastResult).toBe(stopResult);
  });

  it('handles start error gracefully', async () => {
    const startError = new Error('Permission denied');
    vi.spyOn(ShowAndTell, 'startRecording').mockRejectedValue(startError);

    const onError = vi.fn();
    const { result } = renderHook(() => useShowAndTell({ onError }));

    await act(async () => {
      try {
        await result.current.startRecording();
      } catch {
        // Expected
      }
    });

    expect(result.current.state).toBe('error');
    expect(result.current.error?.message).toBe('Permission denied');
    expect(onError).toHaveBeenCalledWith(startError);

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('cleans up active session on unmount when cleanupOnUnmount is true', async () => {
    const mockSession = createMockSession();
    vi.spyOn(ShowAndTell, 'startRecording').mockResolvedValue(mockSession as any);

    const { result, unmount } = renderHook(() =>
      useShowAndTell({ cleanupOnUnmount: true })
    );

    await act(async () => {
      await result.current.startRecording();
    });

    unmount();

    expect(mockSession.stop).toHaveBeenCalled();
  });

  it('updates audioLevel and isSilentMicWarning when session emits audio meter events', async () => {
    const mockSession = createMockSession();
    vi.spyOn(ShowAndTell, 'startRecording').mockResolvedValue(mockSession as any);

    const { result } = renderHook(() => useShowAndTell());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.audioLevel).toEqual({ volume: 0, level: 0 });
    expect(result.current.isSilentMicWarning).toBe(false);

    act(() => {
      mockSession.emit('audioLevel', { volume: 0.45, level: 2 });
    });
    expect(result.current.audioLevel).toEqual({ volume: 0.45, level: 2 });

    act(() => {
      mockSession.emit('silentMicWarning', true);
    });
    expect(result.current.isSilentMicWarning).toBe(true);

    act(() => {
      mockSession.emit('silentMicWarning', false);
    });
    expect(result.current.isSilentMicWarning).toBe(false);
  });

  it('calls ShowAndTell.setTheme when setTheme is invoked', () => {
    const setThemeSpy = vi.spyOn(ShowAndTell, 'setTheme').mockImplementation(() => {});
    const { result } = renderHook(() => useShowAndTell());

    act(() => {
      result.current.setTheme({
        mode: 'light',
        primaryColor: '#6366f1'
      });
    });

    expect(setThemeSpy).toHaveBeenCalledWith({
      mode: 'light',
      primaryColor: '#6366f1'
    });
  });

  it('syncs options.theme to ShowAndTell.setTheme on mount and update', () => {
    const setThemeSpy = vi.spyOn(ShowAndTell, 'setTheme').mockImplementation(() => {});
    const { rerender } = renderHook(
      (props) => useShowAndTell(props),
      { initialProps: { theme: { mode: 'dark' as const, primaryColor: '#10b981' } } }
    );

    expect(setThemeSpy).toHaveBeenCalledWith({
      mode: 'dark',
      primaryColor: '#10b981'
    });

    rerender({ theme: { mode: 'light' as const, primaryColor: '#f43f5e' } });

    expect(setThemeSpy).toHaveBeenCalledWith({
      mode: 'light',
      primaryColor: '#f43f5e'
    });
  });

  it('delegates pruneStorage and getStorageStats to ShowAndTell', async () => {
    const mockPruneResult = {
      evictedSessionIds: ['old_1'],
      freedBytes: 1024,
      remainingBytes: 2048,
      expiredCount: 1,
      overBudgetCount: 0
    };
    const mockStats = {
      totalBytes: 2048,
      sessionCount: 1,
      chunkCount: 2,
      oldestSessionTime: 1000,
      newestSessionTime: 2000
    };

    const pruneSpy = vi.spyOn(ShowAndTell, 'pruneStorage').mockResolvedValue(mockPruneResult);
    const statsSpy = vi.spyOn(ShowAndTell, 'getStorageStats').mockResolvedValue(mockStats);

    const { result } = renderHook(() => useShowAndTell());

    let pruneRes: any;
    let statsRes: any;
    await act(async () => {
      pruneRes = await result.current.pruneStorage({ maxStorageBytes: 5000 });
      statsRes = await result.current.getStorageStats();
    });

    expect(pruneSpy).toHaveBeenCalledWith({ maxStorageBytes: 5000 });
    expect(pruneRes).toEqual(mockPruneResult);

    expect(statsSpy).toHaveBeenCalled();
    expect(statsRes).toEqual(mockStats);
  });

  it('handles discardRecording and resets recording state', async () => {
    const mockSession = createMockSession();
    vi.spyOn(ShowAndTell, 'startRecording').mockResolvedValue(mockSession as any);
    vi.spyOn(ShowAndTell, 'getActiveSession').mockReturnValue(mockSession as any);

    const { result } = renderHook(() => useShowAndTell());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);

    await act(async () => {
      await result.current.discardRecording();
    });

    expect(mockSession.discard).toHaveBeenCalled();
    expect(result.current.isRecording).toBe(false);
    expect(result.current.state).toBe('idle');
  });

  it('handles toggleCamera and updates isCameraActive state', async () => {
    const mockSession = createMockSession();
    vi.spyOn(ShowAndTell, 'startRecording').mockResolvedValue(mockSession as any);
    vi.spyOn(ShowAndTell, 'getActiveSession').mockReturnValue(mockSession as any);

    const { result } = renderHook(() => useShowAndTell());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      const active = result.current.toggleCamera();
      expect(active).toBe(true);
    });

    expect(mockSession.toggleCamera).toHaveBeenCalled();
    expect(result.current.isCameraActive).toBe(true);
  });

  it('handles toggleTelestrator and updates isTelestratorActive state', async () => {
    const mockSession = createMockSession();
    vi.spyOn(ShowAndTell, 'startRecording').mockResolvedValue(mockSession as any);
    vi.spyOn(ShowAndTell, 'getActiveSession').mockReturnValue(mockSession as any);

    const { result } = renderHook(() => useShowAndTell());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isTelestratorActive).toBe(false);

    act(() => {
      const active = result.current.toggleTelestrator();
      expect(active).toBe(true);
    });

    expect(mockSession.toggleTelestrator).toHaveBeenCalled();
    expect(result.current.isTelestratorActive).toBe(true);
  });

  it('delegates clearDrawings, setDrawingTool, setDrawingColor, and toggleDisappearingInk to session', async () => {
    const mockSession = createMockSession();
    vi.spyOn(ShowAndTell, 'startRecording').mockResolvedValue(mockSession as any);
    vi.spyOn(ShowAndTell, 'getActiveSession').mockReturnValue(mockSession as any);

    const { result } = renderHook(() => useShowAndTell());

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      result.current.clearDrawings();
      result.current.setDrawingTool('arrow');
      result.current.setDrawingColor('#3b82f6');
      const ink = result.current.toggleDisappearingInk();
      expect(ink).toBe(true);
    });

    expect(mockSession.clearDrawings).toHaveBeenCalled();
    expect(mockSession.setDrawingTool).toHaveBeenCalledWith('arrow');
    expect(mockSession.setDrawingColor).toHaveBeenCalledWith('#3b82f6');
    expect(mockSession.toggleDisappearingInk).toHaveBeenCalled();
  });
});
