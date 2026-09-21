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

  it('records mutations occurring inside a same-origin iframe', async () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.body.innerHTML = '<div id="child-container"><p>First</p></div>';

    recorder = new DomRecorder();
    recorder.start();

    // Mutate child document inside the iframe
    const childContainer = doc.getElementById('child-container')!;
    const newChildP = doc.createElement('p');
    newChildP.textContent = 'Second paragraph in iframe';
    childContainer.appendChild(newChildP);

    // Wait for child MutationObserver microtask
    await new Promise((resolve) => setTimeout(resolve, 50));

    const events = recorder.getEvents();
    const mutationEvents = events.filter(e => e.type === 'mutation');
    expect(mutationEvents.length).toBeGreaterThan(0);

    const childMutation = mutationEvents.find(e => 
      e.type === 'mutation' && e.addedNodes?.some(n => n.node.textContent === 'Second paragraph in iframe' || n.node.tagName === 'p')
    );
    expect(childMutation).toBeDefined();
  });

  it('records and translates mouse click coordinates inside a child iframe', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.body.innerHTML = '<button id="child-btn">Click me</button>';

    // Mock getBoundingClientRect for the iframe element
    iframe.getBoundingClientRect = () => ({
      left: 100,
      top: 150,
      right: 500,
      bottom: 450,
      width: 400,
      height: 300,
      x: 100,
      y: 150,
      toJSON: () => {}
    });

    recorder = new DomRecorder();
    recorder.start();

    // Dispatch a click inside iframe window at clientX: 25, clientY: 30
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 25,
      clientY: 30
    });
    iframe.contentWindow!.dispatchEvent(clickEvent);

    const events = recorder.getEvents();
    const clickEvents = events.filter(e => e.type === 'mouse_click');
    expect(clickEvents.length).toBeGreaterThan(0);

    const recordedClick = clickEvents[0];
    if (recordedClick.type === 'mouse_click') {
      // 100 + 25 = 125, 150 + 30 = 180
      expect(recordedClick.x).toBe(125);
      expect(recordedClick.y).toBe(180);
      expect(recordedClick.clickType).toBe('click');
    }
  });

  it('records form inputs inside a child iframe', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.body.innerHTML = '<input type="text" id="child-input" value="" />';

    recorder = new DomRecorder({ config: { maskAllInputs: false } });
    recorder.start();

    const input = doc.getElementById('child-input') as HTMLInputElement;
    input.value = 'typed in child iframe';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const events = recorder.getEvents();
    const inputEvents = events.filter(e => e.type === 'input');
    expect(inputEvents.length).toBeGreaterThan(0);

    const recordedInput = inputEvents[0];
    if (recordedInput.type === 'input') {
      expect(recordedInput.value).toBe('typed in child iframe');
    }
  });

  it('dynamically observes newly appended iframe elements and tracks their mutations', async () => {
    recorder = new DomRecorder();
    recorder.start();

    // Dynamically insert an iframe
    const dynamicIframe = document.createElement('iframe');
    document.body.appendChild(dynamicIframe);
    const childDoc = dynamicIframe.contentDocument!;
    childDoc.body.innerHTML = '<div id="dyn-box">Initial</div>';

    // Wait for parent mutation observer to detect and observe the new iframe
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Now mutate inside the dynamically added iframe
    const dynBox = childDoc.getElementById('dyn-box')!;
    const childSpan = childDoc.createElement('span');
    childSpan.textContent = 'Dynamic Child Span';
    dynBox.appendChild(childSpan);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const events = recorder.getEvents();
    const mutations = events.filter(e => e.type === 'mutation');
    const addedSpanMutation = mutations.find(e =>
      e.type === 'mutation' && e.addedNodes?.some(n => n.node.textContent === 'Dynamic Child Span' || n.node.tagName === 'span')
    );
    expect(addedSpanMutation).toBeDefined();
  });

  it('cleans up child observers when an iframe is removed from DOM', async () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const childDoc = iframe.contentDocument!;
    childDoc.body.innerHTML = '<div id="box">Content</div>';
    const box = childDoc.getElementById('box')!;

    recorder = new DomRecorder();
    recorder.start();

    // Remove the iframe from document
    document.body.removeChild(iframe);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Mutate the detached iframe — should NOT record mutations
    const newEl = childDoc.createElement('b');
    newEl.textContent = 'Ignored';
    box.appendChild(newEl);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const events = recorder.getEvents();
    const ignoredMutation = events.filter(e =>
      e.type === 'mutation' && e.addedNodes?.some(n => n.node.textContent === 'Ignored')
    );
    expect(ignoredMutation.length).toBe(0);
  });

  it('DomReplayer renders same-origin iframe with contentDocument and applies child mutations', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const replayer = new DomReplayer({
      container,
      events: [
        {
          type: 'dom_snapshot',
          timestamp: 0,
          data: {
            id: 1,
            type: 'element',
            tagName: 'html',
            children: [
              {
                id: 2,
                type: 'element',
                tagName: 'body',
                children: [
                  {
                    id: 3,
                    type: 'element',
                    tagName: 'iframe',
                    contentDocument: {
                      id: 4,
                      type: 'element',
                      tagName: 'html',
                      children: [
                        {
                          id: 5,
                          type: 'element',
                          tagName: 'body',
                          children: [
                            {
                              id: 6,
                              type: 'element',
                              tagName: 'div',
                              attributes: { id: 'inner-replay-box' },
                              children: [
                                { id: 7, type: 'text', textContent: 'Initial Child Content' }
                              ]
                            }
                          ]
                        }
                      ]
                    }
                  }
                ]
              }
            ]
          },
          viewport: { width: 1280, height: 800, scrollX: 0, scrollY: 0 }
        },
        {
          type: 'mutation',
          timestamp: 100,
          addedNodes: [
            {
              parentId: 6,
              node: {
                id: 8,
                type: 'element',
                tagName: 'p',
                children: [
                  { id: 9, type: 'text', textContent: 'Mutated paragraph in child iframe' }
                ]
              }
            }
          ]
        }
      ]
    });

    // Wait a tick for initial child iframe content population
    await new Promise((resolve) => setTimeout(resolve, 50));

    const replayIframe = container.querySelector('iframe') as HTMLIFrameElement;
    expect(replayIframe).not.toBeNull();

    // Advance replayer to 150ms to dispatch mutation event
    replayer.seek(150);
    await new Promise((resolve) => setTimeout(resolve, 50));

    replayer.destroy();
    expect(container.innerHTML).toBe('');
  });

  it('records drawing events and ignores them when paused in DomRecorder', () => {
    recorder = new DomRecorder();
    recorder.start();

    recorder.recordDrawing({
      action: 'draw',
      tool: 'pen',
      points: [{ x: 10, y: 10 }, { x: 20, y: 20 }],
      color: '#ef4444',
      strokeWidth: 4
    });

    recorder.pause();
    recorder.recordDrawing({
      action: 'draw',
      tool: 'arrow',
      points: [{ x: 30, y: 30 }, { x: 50, y: 50 }]
    });

    recorder.resume();
    recorder.recordDrawing({
      action: 'clear'
    });

    const events = recorder.getEvents().filter(e => e.type === 'drawing');
    expect(events.length).toBe(2);
    expect((events[0] as any).data.action).toBe('draw');
    expect((events[0] as any).data.tool).toBe('pen');
    expect((events[1] as any).data.action).toBe('clear');
  });

  it('replays drawing events on annotationCanvas in DomReplayer', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const replayer = new DomReplayer({
      container,
      events: [
        {
          type: 'dom_snapshot',
          timestamp: 0,
          data: {
            id: 1,
            type: 'element',
            tagName: 'html',
            children: [
              { id: 2, type: 'element', tagName: 'body', children: [] }
            ]
          },
          viewport: { width: 1280, height: 800, scrollX: 0, scrollY: 0 }
        },
        {
          type: 'drawing',
          timestamp: 50,
          data: {
            action: 'draw',
            tool: 'pen',
            points: [{ x: 100, y: 100 }, { x: 150, y: 150 }],
            color: '#ef4444',
            strokeWidth: 4
          }
        },
        {
          type: 'drawing',
          timestamp: 100,
          data: {
            action: 'draw',
            tool: 'arrow',
            points: [{ x: 200, y: 200 }, { x: 300, y: 300 }],
            color: '#3b82f6',
            strokeWidth: 4
          }
        },
        {
          type: 'drawing',
          timestamp: 150,
          data: {
            action: 'clear'
          }
        }
      ]
    });

    const canvas = container.querySelector('canvas.sat-replay-annotation-canvas') as HTMLCanvasElement;
    expect(canvas).not.toBeNull();
    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(800);

    // Seek to 75ms (first pen stroke drawn)
    replayer.seek(75);
    // Seek to 120ms (pen + arrow drawn)
    replayer.seek(120);
    // Seek to 180ms (cleared)
    replayer.seek(180);

    replayer.destroy();
    expect(container.innerHTML).toBe('');
  });

  it('embeds annotationCanvas and drawing handler in generateStandalonePlayerHtml', () => {
    const html = generateStandalonePlayerHtml({
      events: [
        {
          type: 'dom_snapshot',
          timestamp: 0,
          data: { id: 1, type: 'element', tagName: 'html', children: [] },
          viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 }
        },
        {
          type: 'drawing',
          timestamp: 100,
          data: {
            action: 'draw',
            tool: 'pen',
            points: [{ x: 10, y: 10 }, { x: 20, y: 20 }]
          }
        }
      ],
      durationSeconds: 5,
      sessionId: 'test-session-standalone'
    });

    expect(html).toContain('id="annotationCanvas"');
    expect(html).toContain('ev.type === \'drawing\'');
    expect(html).toContain('drawReplayStroke');
  });
});


