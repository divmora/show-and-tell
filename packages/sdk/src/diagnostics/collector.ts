import { DiagnosticEntry, DiagnosticsConfig, NetworkDiagnosticEntry, NetworkDiagnosticsConfig } from '../types';
import { NetworkSanitizer, exportToHar } from './sanitizer';

export class DiagnosticsCollector {
  private config: DiagnosticsConfig;
  private entries: DiagnosticEntry[] = [];
  private isCollecting = false;
  private startTimestamp = 0;
  private maxEntries = 200;
  private sanitizer: NetworkSanitizer;

  // Saved original references for clean restoration
  private originalConsole?: {
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
  };
  private originalFetch?: typeof window.fetch;
  private originalXhrOpen?: typeof XMLHttpRequest.prototype.open;
  private originalXhrSend?: typeof XMLHttpRequest.prototype.send;
  private originalXhrSetRequestHeader?: typeof XMLHttpRequest.prototype.setRequestHeader;
  private errorHandler?: (e: ErrorEvent) => void;
  private rejectionHandler?: (e: PromiseRejectionEvent) => void;

  constructor(config?: boolean | DiagnosticsConfig) {
    if (typeof config === 'boolean') {
      this.config = { enabled: config };
    } else {
      this.config = { enabled: true, ...config };
    }
    this.maxEntries = this.config.maxEntries ?? 200;

    const netConfig: NetworkDiagnosticsConfig =
      typeof this.config.network === 'object' ? this.config.network : {};
    this.sanitizer = new NetworkSanitizer(netConfig);
  }

  start(startTimestamp?: number): void {
    if (this.config.enabled === false) return;
    if (this.isCollecting) return;
    if (typeof window === 'undefined') return;

    this.isCollecting = true;
    this.entries = [];
    this.startTimestamp = startTimestamp ?? Date.now();

    // 1. Console Interception
    if (this.config.console !== false && typeof console !== 'undefined') {
      this.originalConsole = {
        error: console.error,
        warn: console.warn,
        info: console.info
      };

      console.error = (...args: any[]) => {
        this.addEntry('console', 'error', this.formatArgs(args));
        this.originalConsole?.error.apply(console, args);
      };

      console.warn = (...args: any[]) => {
        this.addEntry('console', 'warn', this.formatArgs(args));
        this.originalConsole?.warn.apply(console, args);
      };

      console.info = (...args: any[]) => {
        this.addEntry('console', 'info', this.formatArgs(args));
        this.originalConsole?.info.apply(console, args);
      };
    }

    // 2. Uncaught Error Interception
    if (this.config.uncaughtErrors !== false) {
      this.errorHandler = (e: ErrorEvent) => {
        this.addEntry('error', 'error', e.message || 'Uncaught exception', {
          filename: e.filename,
          lineno: e.lineno,
          colno: e.colno,
          stack: e.error?.stack
        });
      };
      window.addEventListener('error', this.errorHandler);

      this.rejectionHandler = (e: PromiseRejectionEvent) => {
        const msg = e.reason instanceof Error ? e.reason.message : String(e.reason || 'Unhandled promise rejection');
        this.addEntry('error', 'error', msg, {
          stack: e.reason instanceof Error ? e.reason.stack : undefined
        });
      };
      window.addEventListener('unhandledrejection', this.rejectionHandler);
    }

    // 3. Network Interception (Fetch & XHR)
    if (this.config.network !== false) {
      this.interceptFetch();
      this.interceptXhr();
    }
  }

  stop(): DiagnosticEntry[] {
    if (!this.isCollecting) return [...this.entries];
    this.isCollecting = false;

    // Restore Console
    if (this.originalConsole) {
      console.error = this.originalConsole.error;
      console.warn = this.originalConsole.warn;
      console.info = this.originalConsole.info;
      this.originalConsole = undefined;
    }

    // Restore Error Listeners
    if (typeof window !== 'undefined') {
      if (this.errorHandler) {
        window.removeEventListener('error', this.errorHandler);
        this.errorHandler = undefined;
      }
      if (this.rejectionHandler) {
        window.removeEventListener('unhandledrejection', this.rejectionHandler);
        this.rejectionHandler = undefined;
      }
      if (this.originalFetch) {
        window.fetch = this.originalFetch;
        this.originalFetch = undefined;
      }
      if (this.originalXhrOpen) {
        XMLHttpRequest.prototype.open = this.originalXhrOpen;
        this.originalXhrOpen = undefined;
      }
      if (this.originalXhrSend) {
        XMLHttpRequest.prototype.send = this.originalXhrSend;
        this.originalXhrSend = undefined;
      }
      if (this.originalXhrSetRequestHeader) {
        XMLHttpRequest.prototype.setRequestHeader = this.originalXhrSetRequestHeader;
        this.originalXhrSetRequestHeader = undefined;
      }
    }

    return [...this.entries];
  }

  getEntries(): DiagnosticEntry[] {
    return [...this.entries];
  }

  getNetworkEntries(): NetworkDiagnosticEntry[] {
    return this.entries.filter((e): e is NetworkDiagnosticEntry => e.category === 'network');
  }

  exportHar(): object {
    return exportToHar(this.getNetworkEntries());
  }

  private addEntry(
    category: DiagnosticEntry['category'],
    level: DiagnosticEntry['level'],
    message: string,
    details?: DiagnosticEntry['details']
  ): void {
    if (!this.isCollecting) return;
    if (this.entries.length >= this.maxEntries) return;

    const timestamp = Math.max(0, Date.now() - this.startTimestamp);
    const id = `diag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    this.entries.push({
      id,
      category,
      level,
      timestamp,
      timestampMs: timestamp,
      message,
      source: details?.source || category,
      method: details?.method,
      url: details?.url,
      status: details?.status,
      statusText: details?.statusText,
      durationMs: details?.durationMs,
      requestHeaders: details?.requestHeaders,
      responseHeaders: details?.responseHeaders,
      requestBody: details?.requestBody,
      responseBody: details?.responseBody,
      initiatorType: details?.initiatorType,
      details
    });
  }

  private formatArgs(args: any[]): string {
    return args
      .map(a => {
        if (a instanceof Error) return a.stack || a.message;
        if (typeof a === 'object' && a !== null) {
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        }
        return String(a);
      })
      .join(' ');
  }

  private interceptFetch(): void {
    if (typeof window === 'undefined' || !window.fetch) return;
    this.originalFetch = window.fetch;
    const self = this;

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      // Filter out ignored analytics/third-party domains or SDK internal calls
      if (self.sanitizer.shouldIgnore(rawUrl) || rawUrl.includes('/api/upload')) {
        return self.originalFetch!.apply(this, [input, init]);
      }

      const reqStart = performance.now();
      const method = (init?.method || (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
      const cleanUrl = self.sanitizer.sanitizeUrl(rawUrl);

      // Extract and sanitize request headers
      let rawReqHeaders: Record<string, string> = {};
      if (init?.headers) {
        if (typeof Headers !== 'undefined' && init.headers instanceof Headers) {
          init.headers.forEach((val, key) => { rawReqHeaders[key] = val; });
        } else if (Array.isArray(init.headers)) {
          for (const [k, v] of init.headers) { rawReqHeaders[k] = v; }
        } else if (typeof init.headers === 'object') {
          rawReqHeaders = { ...init.headers as Record<string, string> };
        }
      } else if (typeof input === 'object' && 'headers' in input && input.headers) {
        if (typeof Headers !== 'undefined' && input.headers instanceof Headers) {
          input.headers.forEach((val, key) => { rawReqHeaders[key] = val; });
        }
      }
      const sanitizedReqHeaders = self.sanitizer.sanitizeHeaders(rawReqHeaders);

      // Extract request body
      const rawReqBody = init?.body || (typeof input === 'object' && 'body' in input ? (input as any).body : undefined);

      try {
        const response = await self.originalFetch!.apply(this, [input, init]);
        const durationMs = Math.round(performance.now() - reqStart);
        const status = response.status;
        const statusText = response.statusText || (status >= 400 ? 'Error' : 'OK');
        const isError = status >= 400;
        const sanitizedReqBody = self.sanitizer.sanitizeBody(rawReqBody, isError);

        // Extract response headers
        const rawResHeaders: Record<string, string> = {};
        if (response.headers && typeof response.headers.forEach === 'function') {
          response.headers.forEach((val, key) => {
            rawResHeaders[key] = val;
          });
        }
        const sanitizedResHeaders = self.sanitizer.sanitizeHeaders(rawResHeaders);

        // Asynchronously read cloned response body without blocking caller
        let sanitizedResBody: any = undefined;
        const contentType = response.headers?.get('content-type') || '';
        const isEventStream = contentType.includes('text/event-stream');

        if (!isEventStream && typeof response.clone === 'function') {
          try {
            const clone = response.clone();
            clone.text().then(text => {
              sanitizedResBody = self.sanitizer.sanitizeBody(text, isError);
              self.recordNetworkFetchEntry({
                cleanUrl,
                method,
                status,
                statusText,
                durationMs,
                isError,
                reqHeaders: sanitizedReqHeaders,
                resHeaders: sanitizedResHeaders,
                reqBody: sanitizedReqBody,
                resBody: sanitizedResBody
              });
            }).catch(() => {
              self.recordNetworkFetchEntry({
                cleanUrl,
                method,
                status,
                statusText,
                durationMs,
                isError,
                reqHeaders: sanitizedReqHeaders,
                resHeaders: sanitizedResHeaders,
                reqBody: sanitizedReqBody,
                resBody: undefined
              });
            });
            return response;
          } catch {
            // Clone failed
          }
        }

        self.recordNetworkFetchEntry({
          cleanUrl,
          method,
          status,
          statusText,
          durationMs,
          isError,
          reqHeaders: sanitizedReqHeaders,
          resHeaders: sanitizedResHeaders,
          reqBody: sanitizedReqBody,
          resBody: undefined
        });

        return response;
      } catch (err: any) {
        const durationMs = Math.round(performance.now() - reqStart);
        const sanitizedReqBody = self.sanitizer.sanitizeBody(rawReqBody, true);
        self.recordNetworkFetchEntry({
          cleanUrl,
          method,
          status: 0,
          statusText: 'Network Failed',
          durationMs,
          isError: true,
          reqHeaders: sanitizedReqHeaders,
          resHeaders: {},
          reqBody: sanitizedReqBody,
          resBody: err?.message || 'Network Failed'
        });
        throw err;
      }
    };
  }

  private recordNetworkFetchEntry(params: {
    cleanUrl: string;
    method: string;
    status: number;
    statusText: string;
    durationMs: number;
    isError: boolean;
    reqHeaders: Record<string, string>;
    resHeaders: Record<string, string>;
    reqBody: any;
    resBody: any;
  }): void {
    if (!this.isCollecting) return;

    const timestamp = Math.max(0, Date.now() - this.startTimestamp);
    const id = `diag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const level: DiagnosticEntry['level'] = params.isError ? 'error' : (params.status >= 300 ? 'warn' : 'info');

    const rawEntry: NetworkDiagnosticEntry = {
      id,
      category: 'network',
      level,
      timestamp,
      timestampMs: timestamp,
      message: `${params.method} ${params.cleanUrl} (${params.status || 'ERR'} ${params.statusText})`,
      source: 'fetch',
      method: params.method,
      url: params.cleanUrl,
      status: params.status,
      statusText: params.statusText,
      durationMs: params.durationMs,
      requestHeaders: params.reqHeaders,
      responseHeaders: params.resHeaders,
      requestBody: params.reqBody,
      responseBody: params.resBody,
      initiatorType: 'fetch',
      details: {
        method: params.method,
        url: params.cleanUrl,
        status: params.status,
        statusText: params.statusText,
        durationMs: params.durationMs,
        requestHeaders: params.reqHeaders,
        responseHeaders: params.resHeaders,
        requestBody: params.reqBody,
        responseBody: params.resBody,
        initiatorType: 'fetch',
        source: 'fetch'
      }
    };

    const finalized = this.sanitizer.finalizeEntry(rawEntry);
    if (finalized && this.entries.length < this.maxEntries) {
      this.entries.push(finalized);
    }
  }

  private interceptXhr(): void {
    if (typeof window === 'undefined' || !window.XMLHttpRequest) return;
    this.originalXhrOpen = XMLHttpRequest.prototype.open;
    this.originalXhrSend = XMLHttpRequest.prototype.send;
    this.originalXhrSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    const self = this;

    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
      (this as any).__sat_method = method ? method.toUpperCase() : 'GET';
      (this as any).__sat_raw_url = typeof url === 'string' ? url : url.toString();
      (this as any).__sat_url = self.sanitizer.sanitizeUrl((this as any).__sat_raw_url);
      (this as any).__sat_req_headers = {};
      return self.originalXhrOpen!.apply(this, [method, url, ...rest] as any);
    };

    XMLHttpRequest.prototype.setRequestHeader = function (header: string, value: string) {
      if (!(this as any).__sat_req_headers) {
        (this as any).__sat_req_headers = {};
      }
      (this as any).__sat_req_headers[header] = value;
      return self.originalXhrSetRequestHeader!.apply(this, [header, value]);
    };

    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      const rawUrl = (this as any).__sat_raw_url || '';
      if (self.sanitizer.shouldIgnore(rawUrl) || rawUrl.includes('/api/upload')) {
        return self.originalXhrSend!.apply(this, [body] as any);
      }

      const reqStart = performance.now();
      const xhr = this;
      const sanitizedReqHeaders = self.sanitizer.sanitizeHeaders((xhr as any).__sat_req_headers);

      xhr.addEventListener('load', function () {
        const durationMs = Math.round(performance.now() - reqStart);
        const status = xhr.status;
        const statusText = xhr.statusText || (status >= 400 ? 'Error' : 'OK');
        const method = (xhr as any).__sat_method || 'GET';
        const url = (xhr as any).__sat_url || 'xhr';
        const isError = status >= 400;
        const sanitizedReqBody = self.sanitizer.sanitizeBody(body, isError);

        // Parse response headers
        const rawHeaders = xhr.getAllResponseHeaders() || '';
        const resHeaders: Record<string, string> = {};
        rawHeaders.split(/\r?\n/).forEach(line => {
          const parts = line.split(': ');
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join(': ').trim();
            if (key) resHeaders[key] = val;
          }
        });
        const sanitizedResHeaders = self.sanitizer.sanitizeHeaders(resHeaders);

        // Parse response body
        let resBody: any = undefined;
        try {
          if (!xhr.responseType || xhr.responseType === 'text' || xhr.responseType === 'json') {
            const rawText = xhr.responseText;
            resBody = self.sanitizer.sanitizeBody(rawText, isError);
          }
        } catch {
          // Ignore responseText access errors for binary types
        }

        const timestamp = Math.max(0, Date.now() - self.startTimestamp);
        const id = `diag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const level: DiagnosticEntry['level'] = isError ? 'error' : (status >= 300 ? 'warn' : 'info');

        const entry: NetworkDiagnosticEntry = {
          id,
          category: 'network',
          level,
          timestamp,
          timestampMs: timestamp,
          message: `${method} ${url} (${status} ${statusText})`,
          source: 'xhr',
          method,
          url,
          status,
          statusText,
          durationMs,
          requestHeaders: sanitizedReqHeaders,
          responseHeaders: sanitizedResHeaders,
          requestBody: sanitizedReqBody,
          responseBody: resBody,
          initiatorType: 'xhr',
          details: {
            method,
            url,
            status,
            statusText,
            durationMs,
            requestHeaders: sanitizedReqHeaders,
            responseHeaders: sanitizedResHeaders,
            requestBody: sanitizedReqBody,
            responseBody: resBody,
            initiatorType: 'xhr',
            source: 'xhr'
          }
        };

        const finalized = self.sanitizer.finalizeEntry(entry);
        if (finalized && self.entries.length < self.maxEntries) {
          self.entries.push(finalized);
        }
      });

      xhr.addEventListener('error', function () {
        const durationMs = Math.round(performance.now() - reqStart);
        const method = (xhr as any).__sat_method || 'GET';
        const url = (xhr as any).__sat_url || 'xhr';
        const sanitizedReqBody = self.sanitizer.sanitizeBody(body, true);

        const timestamp = Math.max(0, Date.now() - self.startTimestamp);
        const id = `diag_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const entry: NetworkDiagnosticEntry = {
          id,
          category: 'network',
          level: 'error',
          timestamp,
          timestampMs: timestamp,
          message: `${method} ${url} (XHR Failed)`,
          source: 'xhr',
          method,
          url,
          status: 0,
          statusText: 'XHR Failed',
          durationMs,
          requestHeaders: sanitizedReqHeaders,
          responseHeaders: {},
          requestBody: sanitizedReqBody,
          responseBody: 'XHR Network Error',
          initiatorType: 'xhr',
          details: {
            method,
            url,
            status: 0,
            statusText: 'XHR Failed',
            durationMs,
            requestHeaders: sanitizedReqHeaders,
            responseHeaders: {},
            requestBody: sanitizedReqBody,
            initiatorType: 'xhr',
            source: 'xhr'
          }
        };

        const finalized = self.sanitizer.finalizeEntry(entry);
        if (finalized && self.entries.length < self.maxEntries) {
          self.entries.push(finalized);
        }
      });

      return self.originalXhrSend!.apply(this, [body] as any);
    };
  }
}
