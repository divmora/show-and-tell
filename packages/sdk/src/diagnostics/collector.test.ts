import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiagnosticsCollector } from './collector';

describe('DiagnosticsCollector', () => {
  let collector: DiagnosticsCollector;

  beforeEach(() => {
    collector = new DiagnosticsCollector({
      console: true,
      network: true,
      uncaughtErrors: true,
      maxEntries: 50
    });
  });

  afterEach(() => {
    collector.stop();
  });

  it('captures console.error and console.warn calls', () => {
    collector.start(Date.now());

    console.error('Test error message', 123);
    console.warn('Test warning message');

    const entries = collector.getEntries();
    expect(entries.length).toBe(2);
    expect(entries[0].category).toBe('console');
    expect(entries[0].level).toBe('error');
    expect(entries[0].message).toContain('Test error message');
    expect(entries[0].message).toContain('123');

    expect(entries[1].category).toBe('console');
    expect(entries[1].level).toBe('warn');
    expect(entries[1].message).toContain('Test warning message');
  });

  it('restores original console methods on stop', () => {
    const originalError = console.error;
    collector.start(Date.now());
    expect(console.error).not.toBe(originalError);

    collector.stop();
    expect(console.error).toBe(originalError);

    // Further console calls after stop are not recorded
    console.error('Post stop error');
    expect(collector.getEntries().length).toBe(0);
  });

  it('captures failed fetch requests with status >= 400', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 500, statusText: 'Internal Server Error' }));
    const origFetch = window.fetch;
    window.fetch = mockFetch;

    collector.start(Date.now());
    await window.fetch('http://localhost:3000/api/checkout?token=secret123', { method: 'POST' });

    const entries = collector.getEntries();
    const networkEntry = entries.find(e => e.category === 'network');
    expect(networkEntry).toBeDefined();
    expect(networkEntry?.level).toBe('error');
    expect(networkEntry?.message).toContain('POST');
    expect(networkEntry?.message).toContain('500');
    // Verifies sanitization of token
    expect(networkEntry?.message).toContain('token=***');
    expect(networkEntry?.message).not.toContain('secret123');

    collector.stop();
    window.fetch = origFetch;
  });

  it('respects maxEntries ceiling', () => {
    const limitedCollector = new DiagnosticsCollector({ maxEntries: 3 });
    limitedCollector.start(Date.now());

    for (let i = 0; i < 10; i++) {
      console.error(`Error ${i}`);
    }

    expect(limitedCollector.getEntries().length).toBe(3);
    limitedCollector.stop();
  });
});
