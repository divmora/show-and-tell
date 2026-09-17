import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ShowAndTellProvider, useShowAndTellContext } from '../context/ShowAndTellContext';
import { ShowAndTellButton } from './ShowAndTellButton';
import { ShowAndTellWidget } from './ShowAndTellWidget';
import { ShowAndTell } from 'show-and-tell';

function createMockSession() {
  const listeners = new Map<string, Function[]>();

  const session = {
    state: 'recording' as any,
    getStats: vi.fn().mockReturnValue({
      elapsedMs: 2000,
      activeMs: 2000,
      formattedElapsed: '00:02',
      formattedRemaining: undefined,
      progressRatio: undefined,
      isPaused: false,
      isWarning: false
    }),
    isMicMuted: vi.fn(() => false),
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
        durationMs: 2000,
        formattedDuration: '00:02',
        mimeType: 'video/webm',
        filename: 'recording.webm',
        url: 'blob:test',
        discontinueReason: 'user-stop'
      };
      session.emit('stop', result);
      return result;
    }),
    toggleMic: vi.fn(() => true),
    muteMic: vi.fn(),
    unmuteMic: vi.fn(),
    toggleSpotlight: vi.fn(() => true),
    setSpotlight: vi.fn(),
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

describe('ShowAndTellContext & Components', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(ShowAndTell, 'getActiveSession').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ShowAndTellProvider & useShowAndTellContext', () => {
    it('throws descriptive error if useShowAndTellContext is outside provider', () => {
      const TestConsumer = () => {
        useShowAndTellContext();
        return null;
      };

      // Suppress React error boundary console log for expected error
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<TestConsumer />)).toThrowError(/ShowAndTellProvider/);
      consoleError.mockRestore();
    });

    it('provides reactive recording context to descendants', async () => {
      const mockSession = createMockSession();
      vi.spyOn(ShowAndTell, 'startRecording').mockResolvedValue(mockSession as any);

      const Consumer = () => {
        const { state, startRecording } = useShowAndTellContext();
        return (
          <div>
            <span data-testid="state">{state}</span>
            <button onClick={() => startRecording()}>Start Context Rec</button>
          </div>
        );
      };

      render(
        <ShowAndTellProvider>
          <Consumer />
        </ShowAndTellProvider>
      );

      expect(screen.getByTestId('state').textContent).toBe('idle');

      await act(async () => {
        fireEvent.click(screen.getByText('Start Context Rec'));
      });

      expect(screen.getByTestId('state').textContent).toBe('recording');
    });
  });

  describe('ShowAndTellButton', () => {
    it('renders with default idle label and toggles recording on click', async () => {
      const mockSession = createMockSession();
      vi.spyOn(ShowAndTell, 'startRecording').mockResolvedValue(mockSession as any);

      const onStart = vi.fn();
      const onStop = vi.fn();

      render(<ShowAndTellButton onStart={onStart} onStop={onStop} />);

      const button = screen.getByRole('button');
      expect(button.textContent).toContain('Record Screen');

      // Click to start
      await act(async () => {
        fireEvent.click(button);
      });

      expect(ShowAndTell.startRecording).toHaveBeenCalled();
      expect(onStart).toHaveBeenCalledWith(mockSession);
      expect(button.textContent).toContain('Stop Recording');

      // Click to stop
      await act(async () => {
        fireEvent.click(button);
      });

      expect(mockSession.stop).toHaveBeenCalled();
      expect(onStop).toHaveBeenCalled();
    });

    it('supports custom render prop function as child', () => {
      render(
        <ShowAndTellButton>
          {({ state }) => <div data-testid="custom-btn">Custom State: {state}</div>}
        </ShowAndTellButton>
      );

      expect(screen.getByTestId('custom-btn').textContent).toBe('Custom State: idle');
    });
  });

  describe('ShowAndTellWidget', () => {
    it('renders default widget card and interacts with controls', async () => {
      const mockSession = createMockSession();
      vi.spyOn(ShowAndTell, 'startRecording').mockResolvedValue(mockSession as any);

      render(<ShowAndTellWidget />);

      expect(screen.getByText('idle')).toBeDefined();
      const startBtn = screen.getByRole('button', { name: 'Start Recording' });

      await act(async () => {
        fireEvent.click(startBtn);
      });

      expect(ShowAndTell.startRecording).toHaveBeenCalled();
      expect(screen.getByText('recording')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Pause' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Mic On' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Stop' })).toBeDefined();

      // Test Pause
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
      });
      expect(mockSession.pause).toHaveBeenCalled();
      expect(screen.getByText('paused')).toBeDefined();

      // Test Resume
      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
      });
      expect(mockSession.resume).toHaveBeenCalled();
      expect(screen.getByText('recording')).toBeDefined();

      // Test Stop
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
      });
      expect(mockSession.stop).toHaveBeenCalled();
    });

    it('triggers autoStart when prop is true', async () => {
      const mockSession = createMockSession();
      vi.spyOn(ShowAndTell, 'startRecording').mockResolvedValue(mockSession as any);

      await act(async () => {
        render(<ShowAndTellWidget autoStart={true} />);
      });

      await waitFor(() => {
        expect(ShowAndTell.startRecording).toHaveBeenCalledTimes(1);
      });
    });
  });
});
