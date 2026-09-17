import React, { useEffect, useRef, useContext } from 'react';
import { ShowAndTellContext } from '../context/ShowAndTellContext';
import { useShowAndTell } from '../hooks/useShowAndTell';
import type { ShowAndTellWidgetProps, UseShowAndTellReturn } from '../types';

export const ShowAndTellWidget: React.FC<ShowAndTellWidgetProps> = ({
  config,
  theme,
  onStart,
  onStop,
  onError,
  autoStart = false,
  className,
  style,
  children
}) => {
  const context = useContext(ShowAndTellContext);
  const effectiveTheme = theme || config?.theme;
  const localRecording = useShowAndTell({
    ...config,
    ...(effectiveTheme ? { theme: effectiveTheme } : {}),
    onStart,
    onStop,
    onError
  });

  const recording: UseShowAndTellReturn =
    context && !config && !theme && !onStart && !onStop && !onError ? context : localRecording;

  const {
    state,
    isRecording,
    isPaused,
    isMicMuted,
    formattedElapsed,
    formattedRemaining,
    isWarning,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    toggleMic,
    clearError
  } = recording;

  const hasAutoStartedRef = useRef(false);

  useEffect(() => {
    if (autoStart && !hasAutoStartedRef.current && state === 'idle') {
      hasAutoStartedRef.current = true;
      startRecording().catch(() => {});
    }
  }, [autoStart, state, startRecording]);

  if (typeof children === 'function') {
    return <>{children(recording)}</>;
  }

  if (children) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  // Default integrated floating / inline widget card
  const isLight = effectiveTheme?.mode === 'light';
  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '14px 18px',
    borderRadius: effectiveTheme?.borderRadius || '12px',
    backgroundColor: effectiveTheme?.surfaceColor || effectiveTheme?.backgroundColor || (isLight ? '#ffffff' : '#0f172a'),
    color: effectiveTheme?.textColor || (isLight ? '#0f172a' : '#f8fafc'),
    fontFamily:
      effectiveTheme?.fontFamily ||
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    fontSize: '14px',
    boxShadow: isLight
      ? '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)'
      : '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
    border: effectiveTheme?.borderColor
      ? `1px solid ${effectiveTheme.borderColor}`
      : isLight
      ? '1px solid #e2e8f0'
      : '1px solid rgba(255, 255, 255, 0.1)',
    minWidth: '240px',
    ...style
  };

  const btnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: 500,
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    userSelect: 'none'
  };

  return (
    <div className={className} style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isRecording ? '#ef4444' : isPaused ? '#fbbf24' : '#94a3b8'
            }}
          />
          <span style={{ fontWeight: 600, fontSize: '13px', textTransform: 'capitalize' }}>
            {state}
          </span>
        </div>

        {(isRecording || isPaused) && (
          <span
            style={{
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
              fontSize: '13px',
              color: isWarning ? '#f87171' : '#cbd5e1'
            }}
          >
            {formattedRemaining ? `${formattedElapsed} / ${formattedRemaining}` : formattedElapsed}
          </span>
        )}
      </div>

      {error && (
        <div
          style={{
            fontSize: '12px',
            color: '#f87171',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            padding: '6px 8px',
            borderRadius: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>{error.message}</span>
          <button
            onClick={clearError}
            style={{
              background: 'none',
              border: 'none',
              color: '#f87171',
              cursor: 'pointer',
              fontWeight: 'bold',
              padding: '0 4px'
            }}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        {state === 'idle' || state === 'stopped' || state === 'error' ? (
          <button
            type="button"
            style={{
              ...btnStyle,
              backgroundColor: effectiveTheme?.primaryColor || '#3b82f6',
              color: effectiveTheme?.primaryContrastColor || '#ffffff',
              flex: 1
            }}
            onClick={() => startRecording()}
          >
            Start Recording
          </button>
        ) : (
          <>
            {isRecording ? (
              <button
                type="button"
                style={{
                  ...btnStyle,
                  backgroundColor: isLight ? '#e2e8f0' : '#334155',
                  color: isLight ? '#0f172a' : '#f8fafc'
                }}
                onClick={pauseRecording}
              >
                Pause
              </button>
            ) : (
              <button
                type="button"
                style={{
                  ...btnStyle,
                  backgroundColor: isLight ? '#e2e8f0' : '#334155',
                  color: isLight ? '#0f172a' : '#f8fafc'
                }}
                onClick={resumeRecording}
              >
                Resume
              </button>
            )}

            <button
              type="button"
              style={{
                ...btnStyle,
                backgroundColor: isMicMuted ? '#f87171' : '#334155',
                color: '#f8fafc'
              }}
              onClick={toggleMic}
              title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMicMuted ? 'Mic Off' : 'Mic On'}
            </button>

            <button
              type="button"
              style={{ ...btnStyle, backgroundColor: '#ef4444', color: '#ffffff', flex: 1 }}
              onClick={() => stopRecording()}
            >
              Stop
            </button>
          </>
        )}
      </div>
    </div>
  );
};
