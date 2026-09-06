const CANDIDATE_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=h264,opus',
  'video/webm',
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=h264,aac',
  'video/mp4'
];

/**
 * Returns the best supported video MIME type in the current browser.
 */
export function getPreferredMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return 'video/webm;codecs=vp9,opus';
  }

  for (const mime of CANDIDATE_MIME_TYPES) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) {
        return mime;
      }
    } catch {
      // Ignore errors and try next
    }
  }

  // Fallback default
  return 'video/webm';
}

/**
 * Resolves file extension (.webm or .mp4) for a given MIME type.
 */
export function getExtensionForMimeType(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes('mp4')) {
    return 'mp4';
  }
  return 'webm';
}
