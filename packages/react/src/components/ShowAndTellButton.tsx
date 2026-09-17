import React, { useContext } from 'react';
import { ShowAndTellContext } from '../context/ShowAndTellContext';
import { useShowAndTell } from '../hooks/useShowAndTell';
import type { ShowAndTellButtonProps, UseShowAndTellReturn } from '../types';

export const ShowAndTellButton: React.FC<ShowAndTellButtonProps> = ({
  config,
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
  const localRecording = useShowAndTell({
    ...config,
    onStart,
    onStop,
    onError
  });

  // Prefer context when wrapped in ShowAndTellProvider without local prop overrides
  const recording: UseShowAndTellReturn =
    context && !config && !onStart && !onStop && !onError ? context : localRecording;

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

  const defaultButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 500,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    borderRadius: '8px',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    cursor: isTransitioning ? 'not-allowed' : 'pointer',
    opacity: isTransitioning ? 0.75 : 1,
    transition: 'all 0.15s ease-in-out',
    userSelect: 'none',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    backgroundColor: isRecording || isPaused ? '#ef4444' : '#0f172a',
    color: '#ffffff',
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
