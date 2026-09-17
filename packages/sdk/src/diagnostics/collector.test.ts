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

  it('captures sanitized request headers, response headers, and error bodies', async () => {
    const errorPayload = JSON.stringify({
      error: 'Unauthorized',
      password: 'plain_password',
      token: 'jwt_123',
      message: 'Invalid credentials'
    });

    const mockResponse = new Response(errorPayload, {
      status: 401,
      statusText: 'Unauthorized',
      headers: {
        'Content-Type': 'application/json',
        'X-Server-Id': 'app-node-1',
        'Authorization': 'Bearer secret_jwt'
      }
    });

    const origFetch = window.fetch;
    window.fetch = vi.fn().mockResolvedValue(mockResponse);

    collector.start(Date.now());
    await window.fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer my_client_secret',
        'Cookie': 'session=abc'
      },
      body: JSON.stringify({
        username: 'user1',
        password: 'mySecretPassword'
      })
    });

    // Wait a tick for clone.text() to resolve
    await new Promise(r => setTimeout(r, 20));

    const netEntries = collector.getNetworkEntries();
    expect(netEntries.length).toBe(1);
    const entry = netEntries[0];

    expect(entry.method).toBe('POST');
    expect(entry.status).toBe(401);
    expect(entry.statusText).toBe('Unauthorized');

    // Request headers sanitized
    expect(entry.requestHeaders?.['Authorization']).toBe('Bearer [REDACTED]');
    expect(entry.requestHeaders?.['Cookie']).toBe('[REDACTED]');
    expect(entry.requestHeaders?.['Content-Type']).toBe('application/json');

    // Request body sanitized
    expect(entry.requestBody?.username).toBe('user1');
    expect(entry.requestBody?.password).toBe('********');

    // Response body sanitized
    expect(entry.responseBody?.error).toBe('Unauthorized');
    expect(entry.responseBody?.password).toBe('********');
    expect(entry.responseBody?.token).toBe('********');
    expect(entry.responseBody?.message).toBe('Invalid credentials');

    // HAR export generates valid format
    const har: any = collector.exportHar();
    expect(har.log.version).toBe('1.2');
    expect(har.log.entries.length).toBe(1);
    expect(har.log.entries[0].request.method).toBe('POST');
    expect(har.log.entries[0].response.status).toBe(401);

    collector.stop();
    window.fetch = origFetch;
  });
});
