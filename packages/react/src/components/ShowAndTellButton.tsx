import React, { useContext } from 'react';
import { ShowAndTellContext } from '../context/ShowAndTellContext';
import { useShowAndTell } from '../hooks/useShowAndTell';
import type { ShowAndTellButtonProps, UseShowAndTellReturn } from '../types';

export const ShowAndTellButton: React.FC<ShowAndTellButtonProps> = ({
  config,
  theme,
  onStart,
  onStop,
  onError,
  idleText = 'Record Screen',
  recordingText = 'Stop Recording',
  showTimer = true,
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

  // Prefer context when wrapped in ShowAndTellProvider without local prop overrides
  const recording: UseShowAndTellReturn =
    context && !config && !theme && !onStart && !onStop && !onError ? context : localRecording;

  const { state, isRecording, isPaused, formattedElapsed, startRecording, stopRecording } =
    recording;

  const isTransitioning = state === 'starting' || state === 'stopping';

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (isTransitioning) return;

    if (state === 'idle' || state === 'stopped' || state === 'error') {
      try {
        await startRecording();
      } catch {
        // Error is handled via onError or error state
      }
    } else {
      try {
        await stopRecording();
      } catch {
        // Error handled via onError
      }
    }
  };

  if (typeof children === 'function') {
    return <>{children(recording)}</>;
  }

  const idleBg = effectiveTheme?.primaryColor || (effectiveTheme?.mode === 'light' ? '#f1f5f9' : '#0f172a');
  const idleColor = effectiveTheme?.primaryContrastColor || effectiveTheme?.textColor || (effectiveTheme?.mode === 'light' ? '#0f172a' : '#ffffff');
  const borderRadius = effectiveTheme?.borderRadius || '8px';
  const fontFamily = effectiveTheme?.fontFamily ||
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  const defaultButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    fontFamily,
    borderRadius,
    border: effectiveTheme?.borderColor ? `1px solid ${effectiveTheme.borderColor}` : '1px solid rgba(0, 0, 0, 0.1)',
    cursor: isTransitioning ? 'not-allowed' : 'pointer',
    opacity: isTransitioning ? 0.75 : 1,
    transition: 'all 0.15s ease-in-out',
    userSelect: 'none',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    backgroundColor: isRecording || isPaused ? '#ef4444' : idleBg,
    color: isRecording || isPaused ? '#ffffff' : idleColor,
    ...style
  };

  const timerBadgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '12px',
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 600,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    padding: '2px 6px',
    borderRadius: '4px',
    marginLeft: '4px'
  };

  const getLabel = () => {
    if (state === 'starting') return 'Starting...';
    if (state === 'stopping') return 'Finishing...';
    if (isRecording || isPaused) return recordingText;
    return idleText;
  };

  return (
    <button
      type="button"
      className={className}
      style={defaultButtonStyle}
      onClick={handleClick}
      disabled={isTransitioning}
      aria-label={getLabel()}
    >
      {/* Indicator icon */}
      {isRecording ? (
        <span
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '2px',
            backgroundColor: '#ffffff'
          }}
          aria-hidden="true"
        />
      ) : isPaused ? (
        <span
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: '#fbbf24'
          }}
          aria-hidden="true"
        />
      ) : (
        <span
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: '#ef4444'
          }}
          aria-hidden="true"
        />
      )}

      <span>{getLabel()}</span>

      {/* Live duration timer */}
      {showTimer && (isRecording || isPaused) && (
        <span style={timerBadgeStyle}>{formattedElapsed}</span>
      )}
    </button>
  );
};
