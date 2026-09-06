import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DomRecorder } from './recorder';
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
});
