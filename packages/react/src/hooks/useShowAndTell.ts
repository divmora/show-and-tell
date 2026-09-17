import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShowAndTell,
  type RecordingSession,
  type RecordingResult,
  type RecordingState,
  type DurationStats,
  type ShowAndTellConfig,
  type AudioLevelData,
  type ThemeConfig,
  type StoragePruneOptions,
  type StoragePruneResult,
  type StorageStats
} from 'show-and-tell';
import type { UseShowAndTellOptions, UseShowAndTellReturn } from '../types';

/**
 * React hook providing reactive screen recording state and session controls.
 * SSR-safe with automatic cleanup and event management.
 */
export function useShowAndTell(options: UseShowAndTellOptions = {}): UseShowAndTellReturn {
  const {
    cleanupOnUnmount = false,
    onStart,
    onStop,
    onError,
    ...sdkConfig
  } = options;

  const [state, setState] = useState<RecordingState>('idle');
  const [stats, setStats] = useState<DurationStats | null>(null);
  const [formattedElapsed, setFormattedElapsed] = useState('00:00');
  const [formattedRemaining, setFormattedRemaining] = useState<string | undefined>(undefined);
  const [progressRatio, setProgressRatio] = useState<number | undefined>(undefined);
  const [isWarning, setIsWarning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState<AudioLevelData>({ volume: 0, level: 0 });
  const [isSilentMicWarning, setIsSilentMicWarning] = useState(false);
  const [isSpotlightActive, setIsSpotlightActive] = useState(false);
  const [activeSession, setActiveSession] = useState<RecordingSession | null>(null);
  const [lastResult, setLastResult] = useState<RecordingResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const activeSessionRef = useRef<RecordingSession | null>(null);
  const optionsRef = useRef({ onStart, onStop, onError, cleanupOnUnmount });
  optionsRef.current = { onStart, onStop, onError, cleanupOnUnmount };

  const sdkConfigRef = useRef(sdkConfig);
  sdkConfigRef.current = sdkConfig;

  // Sync activeSession with existing global session if already running on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const existing = ShowAndTell.getActiveSession();
    if (existing) {
      activeSessionRef.current = existing;
      setActiveSession(existing);
      setState(existing.state);
      setIsPaused(existing.state === 'paused');
      setIsMicMuted(existing.isMicMuted());
      setIsSpotlightActive(existing.isSpotlightActive());
      const currentStats = existing.getStats();
      setStats(currentStats);
      setFormattedElapsed(currentStats.formattedElapsed);
      setFormattedRemaining(currentStats.formattedRemaining);
      setProgressRatio(currentStats.progressRatio);
      setIsWarning(currentStats.isWarning);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const bindSessionEvents = useCallback((session: RecordingSession) => {
    activeSessionRef.current = session;
    setActiveSession(session);
    setState(session.state);
    setIsPaused(session.state === 'paused');
    setIsMicMuted(session.isMicMuted());

    const offTick = session.on('tick', (s: DurationStats) => {
      setStats(s);
      setFormattedElapsed(s.formattedElapsed);
      setFormattedRemaining(s.formattedRemaining);
      setProgressRatio(s.progressRatio);
      setIsWarning(s.isWarning);
      setIsPaused(s.isPaused);
    });

    const offPause = session.on('pause', () => {
      setState('paused');
      setIsPaused(true);
    });

    const offResume = session.on('resume', () => {
      setState('recording');
      setIsPaused(false);
    });

    const offMic = session.on('micMuteChange', (muted: boolean) => {
      setIsMicMuted(Boolean(muted));
    });

    const offSpotlight = session.on('spotlightChange', (active: boolean) => {
      setIsSpotlightActive(Boolean(active));
    });

    const offAudioLevel = session.on('audioLevel', (lvl: AudioLevelData) => {
      setAudioLevel(lvl);
    });

    const offSilentWarning = session.on('silentMicWarning', (active: boolean) => {
      setIsSilentMicWarning(Boolean(active));
    });

    const offStop = session.on('stop', (result: RecordingResult) => {
      setLastResult(result);
      setState('stopped');
      setActiveSession(null);
      activeSessionRef.current = null;
      optionsRef.current.onStop?.(result);
    });

    const offError = session.on('error', (err: any) => {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      setState('error');
      optionsRef.current.onError?.(errorObj);
    });

    return () => {
      offTick();
      offPause();
      offResume();
      offMic();
      offSpotlight();
      offAudioLevel();
      offSilentWarning();
      offStop();
      offError();
    };
  }, []);

  const startRecording = useCallback(
    async (overrideConfig?: ShowAndTellConfig): Promise<RecordingSession> => {
      if (typeof window === 'undefined') {
        throw new Error('ShowAndTell screen recording is only available in browser environments.');
      }

      setError(null);
      setState('starting');

      try {
        const mergedConfig: ShowAndTellConfig = {
          ...sdkConfigRef.current,
          ...overrideConfig
        };

        const session = await ShowAndTell.startRecording(mergedConfig);
        bindSessionEvents(session);
        optionsRef.current.onStart?.(session);
        return session;
      } catch (err: any) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        setState('error');
        optionsRef.current.onError?.(errorObj);
        throw errorObj;
      }
    },
    [bindSessionEvents]
  );

  const stopRecording = useCallback(async (): Promise<RecordingResult> => {
    const session = activeSessionRef.current || ShowAndTell.getActiveSession();
    if (!session) {
      throw new Error('No active ShowAndTell recording session to stop.');
    }

    setState('stopping');
    try {
      const result = await session.stop();
      setLastResult(result);
      setState('stopped');
      setActiveSession(null);
      activeSessionRef.current = null;
      return result;
    } catch (err: any) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      setState('error');
      throw errorObj;
    }
  }, []);

  const pauseRecording = useCallback(() => {
    const session = activeSessionRef.current || ShowAndTell.getActiveSession();
    if (session) {
      session.pause();
      setIsPaused(true);
      setState('paused');
    }
  }, []);

  const resumeRecording = useCallback(() => {
    const session = activeSessionRef.current || ShowAndTell.getActiveSession();
    if (session) {
      session.resume();
      setIsPaused(false);
      setState('recording');
    }
  }, []);

  const toggleMic = useCallback((): boolean => {
    const session = activeSessionRef.current || ShowAndTell.getActiveSession();
    if (session) {
      const muted = session.toggleMic();
      setIsMicMuted(muted);
      return muted;
    }
    return false;
  }, []);

  const muteMic = useCallback(() => {
    const session = activeSessionRef.current || ShowAndTell.getActiveSession();
    if (session) {
      session.muteMic();
      setIsMicMuted(true);
    }
  }, []);

  const unmuteMic = useCallback(() => {
    const session = activeSessionRef.current || ShowAndTell.getActiveSession();
    if (session) {
      session.unmuteMic();
      setIsMicMuted(false);
    }
  }, []);

  const toggleSpotlight = useCallback((): boolean => {
    const session = activeSessionRef.current || ShowAndTell.getActiveSession();
    if (session) {
      const active = session.toggleSpotlight();
      setIsSpotlightActive(active);
      return active;
    }
    return false;
  }, []);

  const setSpotlight = useCallback((enabled: boolean) => {
    const session = activeSessionRef.current || ShowAndTell.getActiveSession();
    if (session) {
      session.setSpotlight(enabled);
      setIsSpotlightActive(enabled);
    }
  }, []);

  const triggerClickRipple = useCallback((x: number, y: number, color?: string) => {
    const session = activeSessionRef.current || ShowAndTell.getActiveSession();
    if (session) {
      session.triggerClickRipple(x, y, color);
    }
  }, []);

  const setTheme = useCallback((theme: ThemeConfig) => {
    ShowAndTell.setTheme(theme);
  }, []);

  useEffect(() => {
    if (options.theme) {
      ShowAndTell.setTheme(options.theme);
    }
  }, [options.theme]);

  // Cleanup on unmount if requested
  useEffect(() => {
    return () => {
      if (optionsRef.current.cleanupOnUnmount && activeSessionRef.current) {
        activeSessionRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const pruneStorage = useCallback(async (pruneOptions?: StoragePruneOptions): Promise<StoragePruneResult> => {
    return ShowAndTell.pruneStorage(pruneOptions);
  }, []);

  const getStorageStats = useCallback(async (): Promise<StorageStats> => {
    return ShowAndTell.getStorageStats();
  }, []);

  return {
    state,
    isRecording: state === 'recording',
    isPaused,
    isActive: state === 'recording' || state === 'paused',
    stats,
    formattedElapsed,
    formattedRemaining,
    progressRatio,
    isWarning,
    isMicMuted,
    audioLevel,
    isSilentMicWarning,
    isSpotlightActive,
    activeSession,
    lastResult,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    toggleMic,
    muteMic,
    unmuteMic,
    toggleSpotlight,
    setSpotlight,
    triggerClickRipple,
    setTheme,
    clearError,
    pruneStorage,
    getStorageStats
  };
}
