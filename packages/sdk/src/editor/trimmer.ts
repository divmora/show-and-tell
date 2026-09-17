import {
  DiagnosticEntry,
  DomRecordingEvent,
  PresignedUploadConfig,
  PresignedUploadContext,
  PresignedUploadResult,
  RecordingResult,
  TrimRange
} from '../types';
import { generateStandalonePlayerHtml } from '../dom/standalone-player';
import { uploadRecordingAssets } from '../utils/uploader';
import { getExtensionForMimeType } from '../utils/codecs';

/**
 * Trims a DOM-based session recording result to the specified [inSeconds, outSeconds] time window.
 * Preserves the initial dom_snapshot at timestamp 0 and re-offsets all subsequent event timestamps.
 */
export function trimDomRecording(result: RecordingResult, range: TrimRange): RecordingResult {
  const inSeconds = Math.max(0, Math.min(result.duration, range.inSeconds));
  const outSeconds = Math.max(inSeconds + 0.1, Math.min(result.duration, range.outSeconds));
  const inMs = inSeconds * 1000;
  const outMs = outSeconds * 1000;
  const trimmedDuration = Math.max(0.1, Number((outSeconds - inSeconds).toFixed(2)));

  const originalEvents = result.domEvents || [];
  const trimmedEvents: DomRecordingEvent[] = [];

  // 1. Preserve initial dom_snapshot at index 0 if present
  const snapshot = originalEvents.find((e) => e.type === 'dom_snapshot');
  if (snapshot) {
    trimmedEvents.push({
      ...snapshot,
      timestamp: 0
    });
  }

  // 2. Filter events occurring within [inMs, outMs] and re-offset their timestamps
  for (const event of originalEvents) {
    if (event.type === 'dom_snapshot') continue; // Already added as base snapshot
    if (event.timestamp >= inMs && event.timestamp <= outMs) {
      trimmedEvents.push({
        ...event,
        timestamp: Math.max(0, Math.round(event.timestamp - inMs))
      });
    }
  }

  // 3. Filter and re-offset developer diagnostics
  let trimmedDiagnostics: DiagnosticEntry[] | undefined;
  if (result.diagnostics && result.diagnostics.length > 0) {
    trimmedDiagnostics = result.diagnostics
      .filter((d) => d.timestamp >= inMs && d.timestamp <= outMs)
      .map((d) => ({
        ...d,
        timestamp: Math.max(0, Math.round(d.timestamp - inMs)),
        timestampMs: Math.max(0, Math.round(d.timestamp - inMs))
      }));
  }

  // 4. Serialize new JSON Blob
  const jsonString = JSON.stringify(trimmedEvents);
  const newBlob = new Blob([jsonString], { type: 'application/json' });
  const newUrl = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(newBlob) : 'blob:trimmed-dom';

  const baseFilename = result.filename.replace(/\.[^/.]+$/, '');
  const trimmedFilename = `${baseFilename}-trimmed.json`;

  return buildTrimmedResult({
    originalResult: result,
    trimmedBlob: newBlob,
    trimmedUrl: newUrl,
    trimmedDuration,
    trimmedFilename,
    trimRange: { inSeconds, outSeconds },
    domEvents: trimmedEvents,
    diagnostics: trimmedDiagnostics
  });
}

/**
 * Trims a Pixel video recording result to the specified [inSeconds, outSeconds] time window.
 * Uses browser MediaRecorder / Canvas capture when available, or slices the video stream cleanly.
 */
export async function trimPixelRecording(
  result: RecordingResult,
  range: TrimRange,
  onProgress?: (percent: number) => void
): Promise<RecordingResult> {
  const inSeconds = Math.max(0, Math.min(result.duration, range.inSeconds));
  const outSeconds = Math.max(inSeconds + 0.1, Math.min(result.duration, range.outSeconds));
  const inMs = inSeconds * 1000;
  const outMs = outSeconds * 1000;
  const trimmedDuration = Math.max(0.1, Number((outSeconds - inSeconds).toFixed(2)));

  // Filter diagnostics occurring within trim range
  let trimmedDiagnostics: DiagnosticEntry[] | undefined;
  if (result.diagnostics && result.diagnostics.length > 0) {
    trimmedDiagnostics = result.diagnostics
      .filter((d) => d.timestamp >= inMs && d.timestamp <= outMs)
      .map((d) => ({
        ...d,
        timestamp: Math.max(0, Math.round(d.timestamp - inMs)),
        timestampMs: Math.max(0, Math.round(d.timestamp - inMs))
      }));
  }

  let trimmedBlob: Blob;

  // Check if browser environment supports real-time stream capture via <video>
  const canCaptureStream =
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    (typeof (HTMLVideoElement.prototype as any).captureStream === 'function' ||
      typeof (HTMLVideoElement.prototype as any).mozCaptureStream === 'function');

  if (canCaptureStream && result.url && result.duration > 0) {
    try {
      trimmedBlob = await captureVideoSlice(result.url, inSeconds, outSeconds, result.mimeType, onProgress);
    } catch {
      // Gracefully fall back to proportional blob slice if video playback capture fails
      trimmedBlob = sliceBlobFallback(result.blob, inSeconds, outSeconds, result.duration, result.mimeType);
    }
  } else {
    trimmedBlob = sliceBlobFallback(result.blob, inSeconds, outSeconds, result.duration, result.mimeType);
  }

  const newUrl = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(trimmedBlob) : 'blob:trimmed-video';
  const ext = getExtensionForMimeType(result.mimeType);
  const baseFilename = result.filename.replace(/\.[^/.]+$/, '');
  const trimmedFilename = `${baseFilename}-trimmed.${ext}`;

  return buildTrimmedResult({
    originalResult: result,
    trimmedBlob,
    trimmedUrl: newUrl,
    trimmedDuration,
    trimmedFilename,
    trimRange: { inSeconds, outSeconds },
    diagnostics: trimmedDiagnostics
  });
}

/**
 * Trims any RecordingResult (DOM or Pixel) to the specified in/out time window.
 */
export async function trimRecordingResult(
  result: RecordingResult,
  range: TrimRange,
  onProgress?: (percent: number) => void
): Promise<RecordingResult> {
  if (result.mode === 'dom') {
    onProgress?.(100);
    return trimDomRecording(result, range);
  }
  return trimPixelRecording(result, range, onProgress);
}

/**
 * Captures a video slice between inSeconds and outSeconds using an offscreen <video> element and MediaRecorder.
 */
function captureVideoSlice(
  videoUrl: string,
  inSeconds: number,
  outSeconds: number,
  mimeType: string,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.muted = true;

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Video trim capture timed out'));
    }, Math.max(15000, (outSeconds - inSeconds) * 4000));

    let recorder: MediaRecorder | undefined;
    const chunks: Blob[] = [];

    const cleanup = () => {
      clearTimeout(timeout);
      video.pause();
      video.removeAttribute('src');
      video.load();
    };

    video.onloadedmetadata = () => {
      video.currentTime = inSeconds;
    };

    video.onseeked = () => {
      try {
        const stream = typeof (video as any).captureStream === 'function'
          ? (video as any).captureStream()
          : (video as any).mozCaptureStream();

        const recorderMime = MediaRecorder.isTypeSupported(mimeType) ? mimeType : '';
        recorder = recorderMime ? new MediaRecorder(stream, { mimeType: recorderMime }) : new MediaRecorder(stream);

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          cleanup();
          const finalMime = recorder?.mimeType || mimeType || 'video/webm';
          resolve(new Blob(chunks, { type: finalMime }));
        };

        recorder.start(100);
        video.play().catch(reject);

        const duration = outSeconds - inSeconds;
        const checkProgress = () => {
          if (video.currentTime >= outSeconds || video.ended) {
            video.pause();
            if (recorder && recorder.state !== 'inactive') {
              recorder.stop();
            }
          } else {
            const elapsed = Math.max(0, video.currentTime - inSeconds);
            const pct = Math.min(99, Math.round((elapsed / duration) * 100));
            onProgress?.(pct);
            requestAnimationFrame(checkProgress);
          }
        };
        requestAnimationFrame(checkProgress);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to load video element for trimming'));
    };
  });
}

/**
 * Fallback slicing strategy when hardware MediaRecorder or stream capture is unavailable.
 */
function sliceBlobFallback(
  blob: Blob,
  inSeconds: number,
  outSeconds: number,
  totalDuration: number,
  mimeType: string
): Blob {
  if (totalDuration <= 0) return blob;
  const inRatio = inSeconds / totalDuration;
  const outRatio = outSeconds / totalDuration;
  const startByte = Math.floor(inRatio * blob.size);
  const endByte = Math.ceil(outRatio * blob.size);
  return blob.slice(startByte, endByte, mimeType);
}

/**
 * Helper to build a complete RecordingResult object with download, upload, and trim methods.
 */
function buildTrimmedResult(params: {
  originalResult: RecordingResult;
  trimmedBlob: Blob;
  trimmedUrl: string;
  trimmedDuration: number;
  trimmedFilename: string;
  trimRange: TrimRange;
  domEvents?: DomRecordingEvent[];
  diagnostics?: DiagnosticEntry[];
}): RecordingResult {
  const {
    originalResult,
    trimmedBlob,
    trimmedUrl,
    trimmedDuration,
    trimmedFilename,
    trimRange,
    domEvents,
    diagnostics
  } = params;

  const triggerDownload = (blob: Blob, name: string) => {
    if (typeof document === 'undefined') return;
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      if (typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(url);
      }
    }, 100);
  };

  const trimmedResult: RecordingResult = {
    id: `${originalResult.id}-trimmed`,
    mode: originalResult.mode,
    blob: trimmedBlob,
    url: trimmedUrl,
    duration: trimmedDuration,
    mimeType: originalResult.mimeType,
    filename: trimmedFilename,
    size: trimmedBlob.size,
    discontinueReason: originalResult.discontinueReason,
    domEvents,
    diagnostics,
    cameraBlob: originalResult.cameraBlob,
    cameraUrl: originalResult.cameraUrl,
    trimRange,
    originalDuration: originalResult.originalDuration ?? originalResult.duration,
    download: (customFilename?: string) => {
      triggerDownload(trimmedBlob, customFilename || trimmedFilename);
    },
    upload: async (endpointUrl: string, options: RequestInit = {}) => {
      const formData = new FormData();
      formData.append('recording', trimmedBlob, trimmedFilename);
      formData.append('video', trimmedBlob, trimmedFilename);
      if (originalResult.cameraBlob) {
        formData.append('camera', originalResult.cameraBlob, `camera_${originalResult.id}.webm`);
      }
      formData.append('id', `${originalResult.id}-trimmed`);
      formData.append('mode', originalResult.mode);
      formData.append('duration', trimmedDuration.toString());
      formData.append('mimeType', originalResult.mimeType);
      formData.append('discontinueReason', originalResult.discontinueReason);
      formData.append('trimmed', 'true');
      formData.append('inSeconds', trimRange.inSeconds.toString());
      formData.append('outSeconds', trimRange.outSeconds.toString());

      const res = await fetch(endpointUrl, {
        method: 'POST',
        body: formData,
        ...options
      });
      if (!res.ok) {
        throw new Error(`Upload failed with HTTP ${res.status}: ${res.statusText}`);
      }
      return res;
    },
    uploadPresigned: async (config: PresignedUploadConfig): Promise<PresignedUploadResult> => {
      const primaryContext: PresignedUploadContext = {
        id: `${originalResult.id}-trimmed`,
        filename: trimmedFilename,
        mimeType: originalResult.mimeType,
        size: trimmedBlob.size,
        duration: trimmedDuration,
        mode: originalResult.mode,
        fileType: 'recording'
      };

      let cameraContext: PresignedUploadContext | undefined;
      if (originalResult.cameraBlob) {
        cameraContext = {
          id: `${originalResult.id}-trimmed`,
          filename: `camera_${originalResult.id}.webm`,
          mimeType: 'video/webm',
          size: originalResult.cameraBlob.size,
          duration: trimmedDuration,
          mode: originalResult.mode,
          fileType: 'camera'
        };
      }

      const results = await uploadRecordingAssets({
        primaryBlob: trimmedBlob,
        primaryContext,
        cameraBlob: originalResult.cameraBlob,
        cameraContext,
        config
      });

      return results[0];
    },
    revoke: () => {
      if (typeof URL !== 'undefined' && URL.revokeObjectURL) {
        URL.revokeObjectURL(trimmedUrl);
      }
    },
    trim: (inSec: number, outSec: number) => {
      return trimRecordingResult(trimmedResult, { inSeconds: inSec, outSeconds: outSec });
    }
  };

  if (originalResult.mode === 'dom') {
    trimmedResult.downloadJson = (customFilename?: string) => {
      triggerDownload(trimmedBlob, customFilename || trimmedFilename);
    };

    trimmedResult.downloadHtmlReplay = async (customFilename?: string) => {
      let cameraDataUri: string | undefined;
      if (originalResult.cameraBlob) {
        try {
          cameraDataUri = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(originalResult.cameraBlob!);
          });
        } catch {}
      }

      const standaloneHtml = generateStandalonePlayerHtml({
        events: domEvents || [],
        durationSeconds: trimmedDuration,
        sessionId: `${originalResult.id}-trimmed`,
        title: `${originalResult.filename} (Trimmed Replay)`,
        diagnostics: diagnostics || [],
        cameraDataUri: cameraDataUri
      });

      const htmlBlob = new Blob([standaloneHtml], { type: 'text/html' });
      triggerDownload(htmlBlob, customFilename || `${trimmedFilename.replace(/\.json$/, '')}.html`);
    };
  }

  return trimmedResult;
}
