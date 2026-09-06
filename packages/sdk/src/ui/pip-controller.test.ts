import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PipController } from './pip-controller';

describe('PipController', () => {
  let controller: PipController;

  beforeEach(() => {
    controller = new PipController();
  });

  afterEach(() => {
    controller.close();
    delete (window as any).documentPictureInPicture;
  });

  it('detects lack of documentPictureInPicture support gracefully', () => {
    delete (window as any).documentPictureInPicture;
    expect(PipController.isSupported()).toBe(false);
    expect(controller.isActive()).toBe(false);
  });

  it('detects documentPictureInPicture support when API is available', () => {
    (window as any).documentPictureInPicture = {
      requestWindow: vi.fn()
    };
    expect(PipController.isSupported()).toBe(true);
  });

  it('opens always-on-top window and sets up document when supported', async () => {
    const mockPipDoc = document.implementation.createHTMLDocument('PiP Window');
    const mockPipWindow = {
      document: mockPipDoc,
      closed: false,
      close: vi.fn(function(this: any) { this.closed = true; }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    } as unknown as Window;

    (window as any).documentPictureInPicture = {
      requestWindow: vi.fn().mockResolvedValue(mockPipWindow)
    };

    const mockSession = {
      state: 'recording',
      pause: vi.fn(),
      resume: vi.fn(),
      stop: vi.fn(),
      toggleMic: vi.fn().mockReturnValue(true),
      on: vi.fn()
    } as any;

    const win = await controller.open({
      session: mockSession,
      hasMic: true
    });

    expect(win).toBe(mockPipWindow);
    expect(controller.isActive()).toBe(true);
    expect((window as any).documentPictureInPicture.requestWindow).toHaveBeenCalled();

    // Check that layout was rendered into mock Pip document
    expect(mockPipDoc.querySelector('.sat-pip-toolbar')).not.toBeNull();
    expect(mockPipDoc.querySelector('.sat-pip-timer')?.textContent).toBe('00:00');

    // Test updates
    controller.updateTimer(45);
    expect(mockPipDoc.querySelector('.sat-pip-timer')?.textContent).toBe('00:45');

    controller.updateState('paused');
    const pauseBtn = mockPipDoc.querySelector('.sat-pip-btn-pause') as HTMLButtonElement;
    expect(pauseBtn.title).toBe('Resume Recording');

    controller.updateMic(true);
    const micBtn = mockPipDoc.querySelector('.sat-pip-btn-mic') as HTMLButtonElement;
    expect(micBtn).not.toBeNull();

    // Close window
    controller.close();
    expect(controller.isActive()).toBe(false);
  });
});
