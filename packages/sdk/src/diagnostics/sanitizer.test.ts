import { describe, it, expect } from 'vitest';
import { NetworkSanitizer, exportToHar } from './sanitizer';
import { NetworkDiagnosticEntry } from '../types';

describe('NetworkSanitizer', () => {
  describe('URL Sanitization & Filtering', () => {
    it('strips basic authentication credentials from URL', () => {
      const sanitizer = new NetworkSanitizer();
      const clean = sanitizer.sanitizeUrl('https://admin:superSecret123@api.example.com/v1/data');
      expect(clean).toContain('https://admin:***@api.example.com');
      expect(clean).not.toContain('superSecret123');
    });

    it('redacts sensitive query parameters (token, apiKey, secret, password)', () => {
      const sanitizer = new NetworkSanitizer();
      const url = 'https://api.example.com/auth?token=eyJhbGciOiJIUz&api_key=secret_123&password=pass&user=john';
      const clean = sanitizer.sanitizeUrl(url);

      expect(clean).toContain('token=***');
      expect(clean).toContain('api_key=***');
      expect(clean).toContain('password=***');
      expect(clean).toContain('user=john');
      expect(clean).not.toContain('secret_123');
    });

    it('ignores default third-party analytics domains (Google Analytics, Sentry, Segment)', () => {
      const sanitizer = new NetworkSanitizer();
      expect(sanitizer.shouldIgnore('https://www.google-analytics.com/g/collect')).toBe(true);
      expect(sanitizer.shouldIgnore('https://o12345.ingest.sentry.io/api/54321/envelope/')).toBe(true);
      expect(sanitizer.shouldIgnore('https://api.segment.io/v1/p')).toBe(true);
      expect(sanitizer.shouldIgnore('https://api.mycompany.com/v1/orders')).toBe(false);
    });

    it('honors user-configured ignoreUrls and allowedDomains', () => {
      const sanitizer = new NetworkSanitizer({
        ignoreUrls: ['/api/auth/login', /stripe\.com/],
        allowedDomains: ['mycompany.com']
      });

      expect(sanitizer.shouldIgnore('https://mycompany.com/api/auth/login')).toBe(true);
      expect(sanitizer.shouldIgnore('https://api.stripe.com/v1/tokens')).toBe(true);
      expect(sanitizer.shouldIgnore('https://otherdomain.com/api/test')).toBe(true);
      expect(sanitizer.shouldIgnore('https://mycompany.com/api/orders')).toBe(false);
    });
  });

  describe('Header Redaction', () => {
    it('redacts Authorization, Cookie, and API keys', () => {
      const sanitizer = new NetworkSanitizer();
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer my-secret-jwt-token-here',
        'Cookie': 'session=abc123xyz; user_id=42',
        'x-api-key': 'sk_live_12345678',
        'X-CSRF-Token': 'csrf-token-abc',
        'Accept': 'application/json'
      };

      const sanitized = sanitizer.sanitizeHeaders(headers);

      expect(sanitized['Content-Type']).toBe('application/json');
      expect(sanitized['Accept']).toBe('application/json');
      expect(sanitized['Authorization']).toBe('Bearer [REDACTED]');
      expect(sanitized['Cookie']).toBe('[REDACTED]');
      expect(sanitized['x-api-key']).toBe('[REDACTED]');
      expect(sanitized['X-CSRF-Token']).toBe('[REDACTED]');
    });

    it('redacts headers matching sensitive keyword regex', () => {
      const sanitizer = new NetworkSanitizer();
      const headers = {
        'x-custom-auth-token': 'secret-123',
        'my-app-secret': 'very-secret'
      };

      const sanitized = sanitizer.sanitizeHeaders(headers);
      expect(sanitized['x-custom-auth-token']).toBe('[REDACTED]');
      expect(sanitized['my-app-secret']).toBe('[REDACTED]');
    });
  });

  describe('Body Sanitization', () => {
    it('captures error bodies by default and masks sensitive JSON keys', () => {
      const sanitizer = new NetworkSanitizer();
      const errorBody = {
        error: 'InvalidCredentials',
        message: 'Password incorrect',
        password: 'mySecretPassword!',
        token: 'ey12345',
        creditCard: '4111-2222-3333-4444',
        user: {
          email: 'user@example.com',
          ssn: '123-45-6789'
        }
      };

      const sanitized = sanitizer.sanitizeBody(errorBody, true);

      expect(sanitized.error).toBe('InvalidCredentials');
      expect(sanitized.message).toBe('Password incorrect');
      expect(sanitized.password).toBe('********');
      expect(sanitized.token).toBe('********');
      expect(sanitized.creditCard).toBe('********');
      expect(sanitized.user.email).toBe('user@example.com');
      expect(sanitized.user.ssn).toBe('********');
    });

    it('does NOT capture successful (200 OK) bodies by default', () => {
      const sanitizer = new NetworkSanitizer();
      const successBody = { data: 'some customer records', count: 5 };

      const sanitized = sanitizer.sanitizeBody(successBody, false);
      expect(sanitized).toBeUndefined();
    });

    it('captures successful bodies when captureSuccessBodies is explicitly enabled', () => {
      const sanitizer = new NetworkSanitizer({ captureSuccessBodies: true });
      const successBody = {
        status: 'ok',
        password: 'plain_password',
        profile: { name: 'Alice' }
      };

      const sanitized = sanitizer.sanitizeBody(successBody, false);
      expect(sanitized.status).toBe('ok');
      expect(sanitized.password).toBe('********');
      expect(sanitized.profile.name).toBe('Alice');
    });

    it('handles binary FormData and Blobs safely with descriptors', () => {
      const sanitizer = new NetworkSanitizer();
      const blob = new Blob(['sample-data'], { type: 'image/png' });
      const sanitized = sanitizer.sanitizeBody(blob, true);

      expect(sanitized).toContain('[Binary data: Blob');
      expect(sanitized).toContain('image/png');
    });

    it('truncates oversized payloads exceeding maxBodySize', () => {
      const sanitizer = new NetworkSanitizer({ maxBodySize: 100 });
      const hugeString = 'A'.repeat(500);

      const sanitized = sanitizer.sanitizeBody(hugeString, true);
      expect(sanitized.length).toBeLessThan(200);
      expect(sanitized).toContain('[Truncated: exceeds 100 bytes limit]');
    });

    it('redacts raw string credit cards and SSNs via regex', () => {
      const sanitizer = new NetworkSanitizer();
      const rawText = 'User card is 4111 2222 3333 4444 and SSN is 123-45-6789';
      const sanitized = sanitizer.sanitizeBody(rawText, true);

      expect(sanitized).toContain('****-****-****-****');
      expect(sanitized).toContain('***-**-****');
      expect(sanitized).not.toContain('4111 2222 3333 4444');
      expect(sanitized).not.toContain('123-45-6789');
    });
  });

  describe('Developer Custom Hook & HAR Export', () => {
    it('executes custom sanitize callback and drops requests when returning null', () => {
      const sanitizer = new NetworkSanitizer({
        sanitize: (entry) => {
          if (entry.url.includes('/drop-me')) return null;
          if (entry.requestHeaders) {
            entry.requestHeaders['X-Custom'] = 'added';
          }
          return entry;
        }
      });

      const dropEntry: NetworkDiagnosticEntry = {
        id: '1',
        category: 'network',
        level: 'info',
        timestamp: 100,
        message: 'GET /drop-me',
        method: 'GET',
        url: 'https://example.com/drop-me',
        status: 200,
        durationMs: 50
      };

      expect(sanitizer.finalizeEntry(dropEntry)).toBeNull();

      const keepEntry: NetworkDiagnosticEntry = {
        id: '2',
        category: 'network',
        level: 'info',
        timestamp: 100,
        message: 'GET /keep-me',
        method: 'GET',
        url: 'https://example.com/keep-me',
        status: 200,
        durationMs: 50,
        requestHeaders: {}
      };

      const final = sanitizer.finalizeEntry(keepEntry);
      expect(final).not.toBeNull();
      expect(final?.requestHeaders?.['X-Custom']).toBe('added');
    });

    it('exports entries to standard HAR 1.2 format', () => {
      const entries: NetworkDiagnosticEntry[] = [
        {
          id: '1',
          category: 'network',
          level: 'info',
          timestamp: 1000,
          message: 'GET /api/users',
          method: 'GET',
          url: 'https://api.example.com/users',
          status: 200,
          statusText: 'OK',
          durationMs: 45,
          requestHeaders: { 'Accept': 'application/json' },
          responseHeaders: { 'Content-Type': 'application/json' },
          responseBody: { count: 2 }
        }
      ];

      const har: any = exportToHar(entries);
      expect(har.log.version).toBe('1.2');
      expect(har.log.creator.name).toContain('ShowAndTell');
      expect(har.log.entries).toHaveLength(1);
      expect(har.log.entries[0].request.method).toBe('GET');
      expect(har.log.entries[0].response.status).toBe(200);
      expect(har.log.entries[0].response.content.text).toContain('"count": 2');
    });
  });
});
