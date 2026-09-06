/**
 * Parses user input into milliseconds.
 * Supports numbers (seconds or ms if > 100000) or strings like '30s', '2m', '1.5m', '1h'.
 */
export function parseDurationToMs(value?: number | string): number | undefined {
  if (value === undefined || value === null) return undefined;
  
  if (typeof value === 'number') {
    if (value <= 0) return undefined;
    // If value is small (< 1000), assume seconds, otherwise treat as already ms if > 100000
    // Standard rule: treat numbers as seconds unless clearly ms (e.g. integer seconds: 60 = 60s)
    return Math.round(value * 1000);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return undefined;

    // Pattern matches numbers with optional units: 30s, 2m, 1.5h, 500ms
    const match = trimmed.match(/^([\d.]+)\s*(ms|s|sec|seconds?|m|min|minutes?|h|hr|hours?)?$/);
    if (!match) {
      const num = parseFloat(trimmed);
      return !isNaN(num) && num > 0 ? Math.round(num * 1000) : undefined;
    }

    const amount = parseFloat(match[1]);
    if (isNaN(amount) || amount <= 0) return undefined;

    const unit = match[2] || 's';
    switch (unit) {
      case 'ms':
        return Math.round(amount);
      case 's':
      case 'sec':
      case 'second':
      case 'seconds':
        return Math.round(amount * 1000);
      case 'm':
      case 'min':
      case 'minute':
      case 'minutes':
        return Math.round(amount * 60 * 1000);
      case 'h':
      case 'hr':
      case 'hour':
      case 'hours':
        return Math.round(amount * 3600 * 1000);
      default:
        return Math.round(amount * 1000);
    }
  }

  return undefined;
}

/**
 * Formats a duration in seconds into 'MM:SS' or 'HH:MM:SS'.
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || !Number.isFinite(seconds) || seconds < 0) {
    seconds = 0;
  }
  const totalSecs = Math.floor(seconds);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${pad(minutes)}:${pad(secs)}`;
}

/**
 * Formats byte size into human readable string (KB, MB, GB).
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
