import { DiagnosticEntry, DiagnosticsConfig } from '../types';

export class DiagnosticsCollector {
  private config: DiagnosticsConfig;
  private entries: DiagnosticEntry[] = [];
  private isCollecting = false;
  private startTimestamp = 0;
  private maxEntries = 200;

  // Saved original references for clean restoration
  private originalConsole?: {
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
  };
  private originalFetch?: typeof window.fetch;
  private originalXhrOpen?: typeof XMLHttpRequest.prototype.open;
  private originalXhrSend?: typeof XMLHttpRequest.prototype.send;
  private errorHandler?: (e: ErrorEvent) => void;
  private rejectionHandler?: (e: PromiseRejectionEvent) => void;

  constructor(config?: boolean | DiagnosticsConfig) {
    if (typeof config === 'boolean') {
      this.config = { enabled: config };
    } else {
      this.config = { enabled: true, ...config };
    }
    this.maxEntries = this.config.maxEntries ?? 200;
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
      if (this.originalXhrOpen && this.originalXhrSend) {
        XMLHttpRequest.prototype.open = this.originalXhrOpen;
        XMLHttpRequest.prototype.send = this.originalXhrSend;
        this.originalXhrOpen = undefined;
        this.originalXhrSend = undefined;
      }
    }

    return [...this.entries];
  }

  getEntries(): DiagnosticEntry[] {
    return [...this.entries];
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
      durationMs: details?.durationMs,
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

  private sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
      // Redact sensitive query parameters
      const sensitiveKeys = ['token', 'key', 'auth', 'secret', 'password', 'api_key', 'apikey'];
      for (const key of sensitiveKeys) {
        if (parsed.searchParams.has(key)) {
          parsed.searchParams.set(key, '***');
        }
      }
      return parsed.toString();
    } catch {
      return url;
    }
  }

  private interceptFetch(): void {
    if (typeof window === 'undefined' || !window.fetch) return;
    this.originalFetch = window.fetch;
    const self = this;

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const reqStart = performance.now();
      const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method || (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
      const cleanUrl = self.sanitizeUrl(rawUrl);

      try {
        const response = await self.originalFetch!.apply(this, [input, init]);
        const durationMs = Math.round(performance.now() - reqStart);

        if (response.status >= 400) {
          self.addEntry('network', 'error', `${method} ${cleanUrl} (${response.status} ${response.statusText || 'Error'})`, {
            method,
            url: cleanUrl,
            status: response.status,
            durationMs
          });
        }
        return response;
      } catch (err: any) {
        const durationMs = Math.round(performance.now() - reqStart);
        self.addEntry('network', 'error', `${method} ${cleanUrl} (Network Failed)`, {
          method,
          url: cleanUrl,
          status: 0,
          durationMs,
          stack: err?.message
        });
        throw err;
      }
    };
  }

  private interceptXhr(): void {
    if (typeof window === 'undefined' || !window.XMLHttpRequest) return;
    this.originalXhrOpen = XMLHttpRequest.prototype.open;
    this.originalXhrSend = XMLHttpRequest.prototype.send;
    const self = this;

    XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: any[]) {
      (this as any).__sat_method = method ? method.toUpperCase() : 'GET';
      (this as any).__sat_url = self.sanitizeUrl(typeof url === 'string' ? url : url.toString());
      return self.originalXhrOpen!.apply(this, [method, url, ...rest] as any);
    };

    XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      const reqStart = performance.now();
      const xhr = this;

      xhr.addEventListener('load', function () {
        const durationMs = Math.round(performance.now() - reqStart);
        const status = xhr.status;
        const method = (xhr as any).__sat_method || 'GET';
        const url = (xhr as any).__sat_url || 'xhr';

        if (status >= 400) {
          self.addEntry('network', 'error', `${method} ${url} (${status} ${xhr.statusText || 'Error'})`, {
            method,
            url,
            status,
            durationMs
          });
        }
      });

      xhr.addEventListener('error', function () {
        const durationMs = Math.round(performance.now() - reqStart);
        const method = (xhr as any).__sat_method || 'GET';
        const url = (xhr as any).__sat_url || 'xhr';
        self.addEntry('network', 'error', `${method} ${url} (XHR Failed)`, {
          method,
          url,
          status: 0,
          durationMs
        });
      });

      return self.originalXhrSend!.apply(this, [body] as any);
    };
  }
}
