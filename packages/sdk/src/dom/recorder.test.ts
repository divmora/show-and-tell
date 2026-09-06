import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DomRecorder } from './recorder';
import { DomReplayer } from './replayer';
import { generateStandalonePlayerHtml } from './standalone-player';

describe('DomRecorder', () => {
  let recorder: DomRecorder;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"><span>Initial</span></div>';
  });

  afterEach(() => {
    if (recorder) {
      recorder.stop();
    }
  });

  it('captures initial dom_snapshot on start', () => {
    recorder = new DomRecorder();
    const events = recorder.start();

    expect(events.length).toBeGreaterThan(0);
    const snapshot = events[0];
    expect(snapshot.type).toBe('dom_snapshot');
    if (snapshot.type === 'dom_snapshot') {
      expect(snapshot.data.tagName).toBe('html');
      expect(snapshot.viewport.width).toBeGreaterThan(0);
    }
  });

  it('records DOM mutations when elements are added to the document', async () => {
    recorder = new DomRecorder();
    recorder.start();

    const app = document.getElementById('app')!;
    const newParagraph = document.createElement('p');
    newParagraph.textContent = 'Dynamic Paragraph';
    app.appendChild(newParagraph);

    // Wait for MutationObserver microtask
    await new Promise((resolve) => setTimeout(resolve, 50));

    const events = recorder.getEvents();
    const mutationEvents = events.filter(e => e.type === 'mutation');
    expect(mutationEvents.length).toBeGreaterThan(0);

    const firstMutation = mutationEvents[0];
    if (firstMutation.type === 'mutation') {
      expect(firstMutation.addedNodes).toBeDefined();
      expect(firstMutation.addedNodes?.[0]?.node.tagName).toBe('p');
    }
  });

  it('respects pause and resume', async () => {
    recorder = new DomRecorder();
    recorder.start();

    recorder.pause();
    const app = document.getElementById('app')!;
    const ignoredEl = document.createElement('div');
    ignoredEl.id = 'should-be-ignored';
    app.appendChild(ignoredEl);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const eventsWhilePaused = recorder.getEvents();
    const mutations = eventsWhilePaused.filter(e => e.type === 'mutation');
    expect(mutations.length).toBe(0);

    recorder.resume();
    const resumeEl = document.createElement('div');
    resumeEl.id = 'should-be-recorded';
    app.appendChild(resumeEl);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const eventsAfterResume = recorder.getEvents();
    const recordedMutations = eventsAfterResume.filter(e => e.type === 'mutation');
    expect(recordedMutations.length).toBeGreaterThan(0);
  });

  it('generates self-contained standalone HTML player', () => {
    recorder = new DomRecorder();
    const events = recorder.start();
    const html = generateStandalonePlayerHtml({
      events,
      durationSeconds: 5,
      sessionId: 'sat_test_123',
      title: 'Test Session'
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('ShowAndTell');
    expect(html).toContain('sat_test_123');
    expect(html).toContain('dom_snapshot');
    expect(html).toContain('replayFrame');
  });

  it('records input events on select elements with value and selectedIndex', () => {
    document.body.innerHTML = `
      <select id="topicSelect">
        <option value="opt1">Option 1</option>
        <option value="opt2">Option 2</option>
      </select>
    `;

    recorder = new DomRecorder();
    recorder.start();

    const selectEl = document.getElementById('topicSelect') as HTMLSelectElement;
    selectEl.value = 'opt2';
    selectEl.selectedIndex = 1;
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));

    const events = recorder.getEvents();
    const inputEvents = events.filter(e => e.type === 'input');
    expect(inputEvents.length).toBeGreaterThan(0);

    const selectEvent = inputEvents[inputEvents.length - 1];
    if (selectEvent.type === 'input') {
      expect(selectEvent.value).toBe('opt2');
      expect(selectEvent.selectedIndex).toBe(1);
    }
  });

  it('records camera_position events during recording', () => {
    recorder = new DomRecorder();
    recorder.start();

    recorder.recordCameraPosition({
      x: 30,
      y: 100,
      width: 260,
      height: 146,
      shape: 'rect',
      isMuted: false
    });

    const events = recorder.getEvents();
    const camEvents = events.filter(e => e.type === 'camera_position');
    expect(camEvents.length).toBe(1);

    const camEvent = camEvents[0];
    if (camEvent.type === 'camera_position') {
      expect(camEvent.x).toBe(30);
      expect(camEvent.y).toBe(100);
      expect(camEvent.width).toBe(260);
      expect(camEvent.height).toBe(146);
      expect(camEvent.shape).toBe('rect');
      expect(camEvent.isMuted).toBe(false);
    }
  });

  it('embeds camera data URI in standalone player HTML export', () => {
    const html = generateStandalonePlayerHtml({
      events: [
        {
          type: 'dom_snapshot',
          timestamp: 0,
          rootNode: { id: 'root', tagName: 'body', nodeType: 1 },
          viewport: { width: 1280, height: 800, scrollX: 0, scrollY: 0 }
        }
      ],
      durationSeconds: 5,
      sessionId: 'test-session-cam',
      cameraDataUri: 'data:video/webm;base64,GkXfo59ChoEB'
    });

    expect(html).toContain('sat-replay-camera-wrapper');
    expect(html).toContain('data:video/webm;base64,GkXfo59ChoEB');
    expect(html).toContain('sat-replay-camera-video');
  });

  it('DomReplayer mounts and manages camera wrapper when cameraUrl is provided', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const replayer = new DomReplayer({
      container,
      events: [
        {
          type: 'dom_snapshot',
          timestamp: 0,
          rootNode: { id: 'root', tagName: 'body', type: 'element', children: [] },
          viewport: { width: 1280, height: 800, scrollX: 0, scrollY: 0 }
        },
        {
          type: 'camera_position',
          timestamp: 500,
          x: 50,
          y: 60,
          width: 240,
          height: 135,
          shape: 'rect',
          isMuted: false
        }
      ],
      cameraUrl: 'blob:http://localhost/dummy-cam-stream'
    });

    const camWrapper = container.querySelector('.sat-replay-camera-wrapper') as HTMLElement;
    expect(camWrapper).not.toBeNull();

    const camVideo = container.querySelector('video') as HTMLVideoElement;
    expect(camVideo).not.toBeNull();
    expect(camVideo.src).toBe('blob:http://localhost/dummy-cam-stream');

    // Seek to 600ms to trigger the camera_position event
    replayer.seek(600);
    expect(camWrapper.style.left).toBe('50px');
    expect(camWrapper.style.top).toBe('60px');
    expect(camWrapper.style.width).toBe('240px');
    expect(camWrapper.style.height).toBe('135px');
    expect(camWrapper.style.borderRadius).toBe('12px');

    replayer.destroy();
    expect(container.innerHTML).toBe('');
  });
});

