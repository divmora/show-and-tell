import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IframeBridge, initIframeBridge } from './iframe-bridge';
import { DomRecorder } from './recorder';
import { IframeBridgeMessage } from '../types';

describe('IframeBridge (Cross-Origin DOM Recording)', () => {
  let bridge: IframeBridge | undefined;

  beforeEach(() => {
    document.body.innerHTML = '<div id="child-app"><input id="bridge-input" value="inside child" /></div>';
  });

  afterEach(() => {
    if (bridge) {
      bridge.destroy();
      bridge = undefined;
    }
    vi.restoreAllMocks();
  });

  it('initializes and announces availability via initIframeBridge helper', () => {
    bridge = initIframeBridge({ allowedParentOrigins: ['https://parent.example.com'] });
    expect(bridge).toBeInstanceOf(IframeBridge);
  });

  it('responds to sat:ping with sat:pong to parent window', () => {
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage');
    bridge = new IframeBridge({ allowedParentOrigins: ['https://parent.example.com'] });

    // Simulate incoming sat:ping from authorized parent
    const pingEvent = new MessageEvent('message', {
      origin: 'https://parent.example.com',
      data: { type: 'sat:ping' } as IframeBridgeMessage
    });
    window.dispatchEvent(pingEvent);

    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sat:pong' }),
      'https://parent.example.com'
    );
  });

  it('rejects messages from origins not in allowedParentOrigins whitelist', () => {
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage');
    bridge = new IframeBridge({ allowedParentOrigins: ['https://trusted.example.com'] });
    postMessageSpy.mockClear();

    // Simulate incoming message from untrusted malicious origin
    const maliciousPing = new MessageEvent('message', {
      origin: 'https://malicious.evil.com',
      data: { type: 'sat:ping' } as IframeBridgeMessage
    });
    window.dispatchEvent(maliciousPing);

    expect(postMessageSpy).not.toHaveBeenCalled();
  });

  it('starts recording on sat:start and posts initial snapshot to parent', () => {
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage');
    bridge = new IframeBridge();

    const startEvent = new MessageEvent('message', {
      origin: 'https://parent.example.com',
      data: { type: 'sat:start', config: { maskAllInputs: false } } as IframeBridgeMessage
    });
    window.dispatchEvent(startEvent);

    // Verify sat:snapshot was posted to parent
    expect(postMessageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'sat:snapshot',
        data: expect.objectContaining({ tagName: 'html' })
      }),
      'https://parent.example.com'
    );
  });

  it('stops recording on sat:stop', () => {
    bridge = new IframeBridge();
    bridge.start();

    const stopEvent = new MessageEvent('message', {
      origin: 'https://parent.example.com',
      data: { type: 'sat:stop' } as IframeBridgeMessage
    });
    window.dispatchEvent(stopEvent);

    // Calling stop again should be a no-op since it is already stopped
    expect(() => bridge?.stop()).not.toThrow();
  });

  it('parent DomRecorder receives child bridge chunk and translates coordinates', async () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);

    // Mock iframe bounding rect
    iframe.getBoundingClientRect = () => ({
      left: 120,
      top: 80,
      right: 520,
      bottom: 380,
      width: 400,
      height: 300,
      x: 120,
      y: 80,
      toJSON: () => {}
    });

    const parentRecorder = new DomRecorder({
      config: {
        recordCrossOriginIframes: true,
        allowedIframeOrigins: ['https://child.example.com']
      }
    });
    parentRecorder.start();

    // Simulate child bridge sending sat:chunk with mouse_click (x: 10, y: 20)
    const chunkEvent = new MessageEvent('message', {
      origin: 'https://child.example.com',
      source: iframe.contentWindow,
      data: {
        type: 'sat:chunk',
        events: [
          {
            type: 'mouse_click',
            timestamp: 50,
            x: 10,
            y: 20,
            clickType: 'click'
          }
        ]
      } as IframeBridgeMessage
    });
    window.dispatchEvent(chunkEvent);

    const recordedEvents = parentRecorder.getEvents();
    const clickEvents = recordedEvents.filter(e => e.type === 'mouse_click');
    expect(clickEvents.length).toBeGreaterThan(0);

    const translatedClick = clickEvents[0];
    if (translatedClick.type === 'mouse_click') {
      // 120 + 10 = 130, 80 + 20 = 100
      expect(translatedClick.x).toBe(130);
      expect(translatedClick.y).toBe(100);
      expect(translatedClick.clickType).toBe('click');
    }

    parentRecorder.stop();
  });
});
