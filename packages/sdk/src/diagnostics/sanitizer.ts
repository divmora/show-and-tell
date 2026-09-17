import { NetworkDiagnosticsConfig, NetworkDiagnosticEntry } from '../types';

export const DEFAULT_MAX_BODY_SIZE = 8192; // 8 KB

export const DEFAULT_SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-api-key',
  'api-key',
  'apikey',
  'x-auth-token',
  'x-access-token',
  'x-csrf-token',
  'x-xsrf-token',
  'csrf-token',
  'xsrf-token'
];

export const SENSITIVE_HEADER_REGEX = /token|auth|key|secret|cookie|credential|password|xsrf|csrf/i;

export const DEFAULT_SENSITIVE_QUERY_PARAMS = [
  'token',
  'key',
  'auth',
  'secret',
  'password',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'session',
  'session_id',
  'jwt',
  'sig',
  'signature',
  'code',
  'state'
];

export const DEFAULT_SENSITIVE_JSON_KEYS = [
  'password',
  'passwd',
  'pwd',
  'pass',
  'secret',
  'clientsecret',
  'client_secret',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'idtoken',
  'id_token',
  'authtoken',
  'auth_token',
  'bearer',
  'jwt',
  'apikey',
  'api_key',
  'privatekey',
  'private_key',
  'creditcard',
  'credit_card',
  'cardnumber',
  'card_number',
  'pan',
  'cvv',
  'cvc',
  'securitycode',
  'security_code',
  'routingnumber',
  'routing_number',
  'accountnumber',
  'account_number',
  'ssn',
  'socialsecurity',
  'social_security_number',
  'aadhar',
  'pannumber',
  'nationalid',
  'pin',
  'otp'
];

export const DEFAULT_IGNORED_DOMAINS = [
  'google-analytics.com',
  'analytics.google.com',
  'stats.g.doubleclick.net',
  'segment.io',
  'api.segment.io',
  'sentry.io',
  'datadoghq.com',
  'mixpanel.com',
  'hotjar.com'
];

// High-confidence regex patterns for string data
const CREDIT_CARD_REGEX = /\b(?:\d{4}[ -]?){3}\d{4}\b/g;
const JWT_REGEX = /\beyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g;
const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/g;

export class NetworkSanitizer {
  private config: NetworkDiagnosticsConfig;
  private sensitiveHeaders: Set<string>;
  private sensitiveQueryParams: Set<string>;
  private sensitiveJsonKeys: Set<string>;
  private maxBodySize: number;

  constructor(config?: NetworkDiagnosticsConfig) {
    this.config = config || {};
    this.maxBodySize = this.config.maxBodySize ?? DEFAULT_MAX_BODY_SIZE;

    // Build sensitive sets
    this.sensitiveHeaders = new Set(DEFAULT_SENSITIVE_HEADERS.map(h => h.toLowerCase()));
    if (this.config.sanitizeRules?.headers) {
      for (const h of this.config.sanitizeRules.headers) {
        this.sensitiveHeaders.add(h.toLowerCase());
      }
    }

    this.sensitiveQueryParams = new Set(DEFAULT_SENSITIVE_QUERY_PARAMS.map(q => q.toLowerCase()));
    if (this.config.sanitizeRules?.queryParams) {
      for (const q of this.config.sanitizeRules.queryParams) {
        this.sensitiveQueryParams.add(q.toLowerCase());
      }
    }

    this.sensitiveJsonKeys = new Set(DEFAULT_SENSITIVE_JSON_KEYS.map(k => k.toLowerCase()));
    if (this.config.sanitizeRules?.jsonKeys) {
      for (const k of this.config.sanitizeRules.jsonKeys) {
        this.sensitiveJsonKeys.add(k.toLowerCase());
      }
    }
  }

  /**
   * Check whether a given URL should be ignored completely.
   */
  shouldIgnore(rawUrl: string): boolean {
    if (!rawUrl) return true;

    try {
      const base = typeof window !== 'undefined' ? window.location.href : 'http://localhost';
      const parsed = new URL(rawUrl, base);
      const hostname = parsed.hostname.toLowerCase();

      // Check default ignored analytics domains
      for (const domain of DEFAULT_IGNORED_DOMAINS) {
        if (hostname === domain || hostname.endsWith(`.${domain}`)) {
          return true;
        }
      }

      // Check allowedDomains whitelist if specified
      if (this.config.allowedDomains && this.config.allowedDomains.length > 0) {
        const allowed = this.config.allowedDomains.some(d => {
          const dl = d.toLowerCase();
          return hostname === dl || hostname.endsWith(`.${dl}`);
        });
        if (!allowed) return true;
      }

      // Check user ignoreUrls
      if (this.config.ignoreUrls && this.config.ignoreUrls.length > 0) {
        for (const pattern of this.config.ignoreUrls) {
          if (typeof pattern === 'string') {
            if (rawUrl.includes(pattern) || parsed.pathname.includes(pattern)) {
              return true;
            }
          } else if (pattern instanceof RegExp) {
            if (pattern.test(rawUrl)) {
              return true;
            }
          }
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Strip basic auth and sanitize sensitive query parameters in a URL.
   */
  sanitizeUrl(rawUrl: string): string {
    if (!rawUrl) return '';

    try {
      const base = typeof window !== 'undefined' ? window.location.href : 'http://localhost';
      const parsed = new URL(rawUrl, base);

      // Strip basic authentication password
      if (parsed.password) parsed.password = '***';

      // Redact sensitive query params
      const keysToRedact: string[] = [];
      parsed.searchParams.forEach((_, key) => {
        const lowerKey = key.toLowerCase();
        if (this.sensitiveQueryParams.has(lowerKey) || SENSITIVE_HEADER_REGEX.test(lowerKey)) {
          keysToRedact.push(key);
        }
      });

      for (const k of keysToRedact) {
        parsed.searchParams.set(k, '***');
      }

      return parsed.toString();
    } catch {
      return rawUrl;
    }
  }

  /**
   * Redact sensitive HTTP headers.
   */
  sanitizeHeaders(headers?: Record<string, string> | Headers | [string, string][] | null): Record<string, string> {
    if (!headers) return {};

    const result: Record<string, string> = {};

    if (typeof Headers !== 'undefined' && headers instanceof Headers) {
      headers.forEach((val, key) => {
        result[key] = this.maskHeaderValue(key, val);
      });
    } else if (Array.isArray(headers)) {
      for (const [key, val] of headers) {
        if (key) {
          result[key] = this.maskHeaderValue(key, val);
        }
      }
    } else if (typeof headers === 'object' && headers !== null) {
      const headerObj = headers as Record<string, string>;
      for (const key of Object.keys(headerObj)) {
        result[key] = this.maskHeaderValue(key, headerObj[key]);
      }
    }

    return result;
  }

  private maskHeaderValue(name: string, value: string): string {
    const lowerName = name.toLowerCase();

    if (this.sensitiveHeaders.has(lowerName) || SENSITIVE_HEADER_REGEX.test(lowerName)) {
      if (lowerName === 'authorization') {
        const trimmed = value.trim();
        if (trimmed.toLowerCase().startsWith('bearer ')) {
          return 'Bearer [REDACTED]';
        }
        if (trimmed.toLowerCase().startsWith('basic ')) {
          return 'Basic [REDACTED]';
        }
      }
      return '[REDACTED]';
    }

    // Also check for JWT strings in header values
    if (typeof value === 'string' && JWT_REGEX.test(value)) {
      return value.replace(JWT_REGEX, 'eyJ...[REDACTED]');
    }

    return value;
  }

  /**
   * Redact request and response bodies.
   * Recursively sanitizes JSON, masks credit cards/JWT/SSN, and truncates if exceeding maxBodySize.
   */
  sanitizeBody(body: any, isError = false): any {
    if (body === undefined || body === null) return undefined;

    // Check if body capture is allowed
    const captureAll = this.config.captureBodies === true;
    const captureErrors = this.config.captureErrorBodies !== false;
    const captureSuccess = this.config.captureSuccessBodies === true;

    if (isError) {
      if (!captureAll && !captureErrors) return undefined;
    } else {
      if (!captureAll && !captureSuccess) return undefined;
    }

    // Handle binary / form data descriptors
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      return '[Binary data: FormData]';
    }
    if (typeof Blob !== 'undefined' && body instanceof Blob) {
      return `[Binary data: Blob (${Math.round(body.size / 1024)} KB, ${body.type || 'unknown'})]`;
    }
    if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) {
      return `[Binary data: ArrayBuffer (${body.byteLength} bytes)]`;
    }

    // If body is already a parsed object
    if (typeof body === 'object') {
      try {
        const cleaned = this.sanitizeObject(body);
        const jsonStr = JSON.stringify(cleaned);
        if (jsonStr.length > this.maxBodySize) {
          return jsonStr.slice(0, this.maxBodySize) + `\n... [Truncated: exceeds ${this.maxBodySize} bytes limit]`;
        }
        return cleaned;
      } catch {
        return '[Unserializable Object]';
      }
    }

    // If body is a string, check if it is JSON
    if (typeof body === 'string') {
      const trimmed = body.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          const parsed = JSON.parse(trimmed);
          const cleaned = this.sanitizeObject(parsed);
          const jsonStr = JSON.stringify(cleaned);
          if (jsonStr.length > this.maxBodySize) {
            return jsonStr.slice(0, this.maxBodySize) + `\n... [Truncated: exceeds ${this.maxBodySize} bytes limit]`;
          }
          return cleaned;
        } catch {
          // Fall through to plain text sanitize
        }
      }

      // Plain text sanitize
      let text = body;
      text = text.replace(CREDIT_CARD_REGEX, '****-****-****-****');
      text = text.replace(JWT_REGEX, 'eyJ...[REDACTED]');
      text = text.replace(SSN_REGEX, '***-**-****');

      if (text.length > this.maxBodySize) {
        return text.slice(0, this.maxBodySize) + `\n... [Truncated: exceeds ${this.maxBodySize} bytes limit]`;
      }

      return text;
    }

    return String(body);
  }

  /**
   * Recursively redact sensitive keys in an object or array.
   */
  private sanitizeObject(obj: any, depth = 0): any {
    if (depth > 12) return '[Truncated: Max Depth]';
    if (obj === null || obj === undefined) return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, depth + 1));
    }

    if (typeof obj === 'object') {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        const lowerKey = k.toLowerCase().replace(/[-_]/g, '');
        if (this.sensitiveJsonKeys.has(lowerKey) || SENSITIVE_HEADER_REGEX.test(lowerKey)) {
          result[k] = '********';
        } else if (typeof v === 'string') {
          let str = v;
          str = str.replace(CREDIT_CARD_REGEX, '****-****-****-****');
          str = str.replace(JWT_REGEX, 'eyJ...[REDACTED]');
          str = str.replace(SSN_REGEX, '***-**-****');
          result[k] = str;
        } else {
          result[k] = this.sanitizeObject(v, depth + 1);
        }
      }
      return result;
    }

    return obj;
  }

  /**
   * Run the full sanitization pass on a NetworkDiagnosticEntry and execute custom developer hook if configured.
   */
  finalizeEntry(entry: NetworkDiagnosticEntry): NetworkDiagnosticEntry | null {
    // Check developer custom hook first
    if (this.config.sanitize && typeof this.config.sanitize === 'function') {
      try {
        const customResult = this.config.sanitize(entry);
        if (!customResult) return null; // Developer chose to drop this request
        return customResult;
      } catch (err) {
        console.warn('[ShowAndTell] Custom network sanitize hook threw an error:', err);
      }
    }

    return entry;
  }
}

/**
 * Generate HTTP Archive (HAR) 1.2 compliant JSON structure from NetworkDiagnosticEntry records.
 */
export function exportToHar(entries: NetworkDiagnosticEntry[]): object {
  const harEntries = entries.map(entry => {
    const startedDateTime = new Date(Date.now() - (entry.durationMs || 0)).toISOString();
    const isError = entry.status >= 400 || entry.status === 0;

    const requestHeaders = Object.entries(entry.requestHeaders || {}).map(([name, value]) => ({
      name,
      value
    }));

    const responseHeaders = Object.entries(entry.responseHeaders || {}).map(([name, value]) => ({
      name,
      value
    }));

    let reqPostData: any = undefined;
    if (entry.requestBody) {
      const mimeType = typeof entry.requestBody === 'object' ? 'application/json' : 'text/plain';
      reqPostData = {
        mimeType,
        text: typeof entry.requestBody === 'object' ? JSON.stringify(entry.requestBody, null, 2) : String(entry.requestBody)
      };
    }

    let resContent: any = {
      size: 0,
      mimeType: 'application/json',
      text: ''
    };

    if (entry.responseBody) {
      const mimeType = typeof entry.responseBody === 'object' ? 'application/json' : 'text/plain';
      const text = typeof entry.responseBody === 'object' ? JSON.stringify(entry.responseBody, null, 2) : String(entry.responseBody);
      resContent = {
        size: text.length,
        mimeType,
        text
      };
    }

    return {
      startedDateTime,
      time: entry.durationMs || 0,
      request: {
        method: entry.method || 'GET',
        url: entry.url,
        httpVersion: 'HTTP/1.1',
        headers: requestHeaders,
        queryString: [],
        cookies: [],
        headersSize: -1,
        bodySize: reqPostData ? reqPostData.text.length : 0,
        postData: reqPostData
      },
      response: {
        status: entry.status || 0,
        statusText: entry.statusText || (isError ? 'Error' : 'OK'),
        httpVersion: 'HTTP/1.1',
        headers: responseHeaders,
        cookies: [],
        content: resContent,
        redirectURL: '',
        headersSize: -1,
        bodySize: resContent.size
      },
      cache: {},
      timings: {
        send: 0,
        wait: entry.durationMs || 0,
        receive: 0
      }
    };
  });

  return {
    log: {
      version: '1.2',
      creator: {
        name: 'ShowAndTell SDK Network Inspector',
        version: '0.2.0'
      },
      pages: [],
      entries: harEntries
    }
  };
}
