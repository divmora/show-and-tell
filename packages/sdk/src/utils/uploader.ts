import {
  PresignedUrlTarget,
  PresignedUploadContext,
  PresignedUploadConfig,
  PresignedUploadResult,
  UploadProgress
} from '../types';

/**
 * Parse raw XMLHttpRequest response headers into a normalized key-value record.
 */
export function parseResponseHeaders(headerStr: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!headerStr) return headers;

  const lines = headerStr.trim().split(/[\r\n]+/);
  for (const line of lines) {
    const parts = line.split(': ');
    const key = parts.shift();
    const value = parts.join(': ');
    if (key) {
      headers[key.toLowerCase()] = value;
    }
  }
  return headers;
}

/**
 * Attempt to extract meaningful error descriptions from S3 XML, JSON, or plain text error responses.
 */
export function extractErrorMessage(status: number, statusText: string, responseText: string): string {
  if (!responseText) {
    return `Upload failed with HTTP ${status}: ${statusText || 'Unknown Error'}`;
  }

  // Try parsing S3/R2 XML response: <Error><Code>...</Code><Message>...</Message></Error>
  const messageMatch = responseText.match(/<Message>(.*?)<\/Message>/i);
  const codeMatch = responseText.match(/<Code>(.*?)<\/Code>/i);
  if (messageMatch && messageMatch[1]) {
    const code = codeMatch && codeMatch[1] ? ` (${codeMatch[1]})` : '';
    return `Storage error: ${messageMatch[1]}${code}`;
  }

  // Try parsing JSON error response (e.g. Supabase, custom server)
  try {
    const json = JSON.parse(responseText);
    if (typeof json.message === 'string') return json.message;
    if (typeof json.error === 'string') return json.error;
    if (typeof json.error?.message === 'string') return json.error.message;
  } catch {
    // Ignore JSON parse failure
  }

  // Fallback to truncated plain text if brief
  const trimmed = responseText.trim().replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');
  if (trimmed.length > 0 && trimmed.length <= 150) {
    return `Upload failed (${status}): ${trimmed}`;
  }

  return `Upload failed with HTTP ${status}: ${statusText || 'Unknown Error'}`;
}

export interface UploadBlobOptions {
  filename?: string;
  fileType?: 'recording' | 'camera' | 'diagnostics';
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}

/**
 * Uploads a single Blob to a presigned URL target using XMLHttpRequest for precise byte-level progress reporting.
 * Supports both HTTP PUT (S3, Cloudflare R2, Supabase) and HTTP POST multipart policy form fields.
 */
export function uploadBlobToPresignedTarget(
  blob: Blob,
  target: PresignedUrlTarget,
  options: UploadBlobOptions = {}
): Promise<PresignedUploadResult> {
  return new Promise((resolve, reject) => {
    const {
      filename = 'recording.webm',
      fileType = 'recording',
      onProgress,
      signal
    } = options;

    if (signal?.aborted) {
      reject(signal.reason || new DOMException('Upload aborted', 'AbortError'));
      return;
    }

    const xhr = new XMLHttpRequest();
    const method = (target.method || 'PUT').toUpperCase();
    const isPostMultipart = method === 'POST' && !!target.fields;

    xhr.open(method, target.url, true);

    // Track upload progress
    if (xhr.upload) {
      xhr.upload.onprogress = (evt: ProgressEvent) => {
        if (evt.lengthComputable && onProgress) {
          const percent = Math.min(100, Math.round((evt.loaded / evt.total) * 100));
          onProgress({
            loaded: evt.loaded,
            total: evt.total,
            percent,
            fileType
          });
        }
      };
    }

    // Set custom request headers
    if (target.headers) {
      Object.entries(target.headers).forEach(([key, val]) => {
        // Do not set Content-Type header when sending FormData; browser sets boundary automatically
        if (isPostMultipart && key.toLowerCase() === 'content-type') return;
        xhr.setRequestHeader(key, val);
      });
    }

    // If PUT or non-multipart POST without explicit Content-Type, provide blob type if available
    if (!isPostMultipart) {
      const hasContentType = target.headers && Object.keys(target.headers).some(
        k => k.toLowerCase() === 'content-type'
      );
      if (!hasContentType && blob.type) {
        xhr.setRequestHeader('Content-Type', blob.type);
      }
    }

    // Handle AbortSignal cancellation
    let abortListener: (() => void) | undefined;
    if (signal) {
      abortListener = () => {
        xhr.abort();
      };
      signal.addEventListener('abort', abortListener);
    }

    const cleanup = () => {
      if (signal && abortListener) {
        signal.removeEventListener('abort', abortListener);
      }
    };

    xhr.onload = () => {
      cleanup();
      // HTTP 200 - 299 indicate success (e.g. 200 OK, 204 No Content for S3 POST)
      if (xhr.status >= 200 && xhr.status < 300) {
        // Ensure 100% progress has been emitted upon completion
        if (onProgress) {
          onProgress({
            loaded: blob.size,
            total: blob.size,
            percent: 100,
            fileType
          });
        }

        const headers = parseResponseHeaders(xhr.getAllResponseHeaders());
        resolve({
          target,
          status: xhr.status,
          headers,
          publicUrl: target.publicUrl,
          fileType
        });
      } else {
        const errorMsg = extractErrorMessage(xhr.status, xhr.statusText, xhr.responseText);
        reject(new Error(errorMsg));
      }
    };

    xhr.onerror = () => {
      cleanup();
      reject(new Error('Network error occurred during presigned upload. Check CORS settings on storage bucket.'));
    };

    xhr.ontimeout = () => {
      cleanup();
      reject(new Error('Upload request timed out.'));
    };

    xhr.onabort = () => {
      cleanup();
      reject(signal?.reason || new DOMException('Upload was cancelled.', 'AbortError'));
    };

    // Prepare and dispatch request payload
    if (isPostMultipart) {
      const formData = new FormData();
      // Append all presigned policy fields first
      if (target.fields) {
        Object.entries(target.fields).forEach(([k, v]) => {
          formData.append(k, v);
        });
      }
      // Append the file binary (standard S3 form field is 'file')
      formData.append('file', blob, filename);
      xhr.send(formData);
    } else {
      xhr.send(blob);
    }
  });
}

export interface MultiAssetUploadParams {
  primaryBlob: Blob;
  primaryContext: PresignedUploadContext;
  cameraBlob?: Blob;
  cameraContext?: PresignedUploadContext;
  config: PresignedUploadConfig;
  signal?: AbortSignal;
}

/**
 * Orchestrates direct presigned upload for primary recording and optional secondary camera bubble recording,
 * calculating unified progress across assets and calling lifecycle callbacks.
 */
export async function uploadRecordingAssets(
  params: MultiAssetUploadParams
): Promise<PresignedUploadResult[]> {
  const {
    primaryBlob,
    primaryContext,
    cameraBlob,
    cameraContext,
    config,
    signal
  } = params;

  const totalBytes = primaryBlob.size + (cameraBlob ? cameraBlob.size : 0);
  let primaryLoaded = 0;
  let cameraLoaded = 0;

  const emitUnifiedProgress = (fileType: 'recording' | 'camera' | 'diagnostics') => {
    if (!config.onProgress) return;
    const currentLoaded = primaryLoaded + cameraLoaded;
    const percent = totalBytes > 0 ? Math.min(100, Math.round((currentLoaded / totalBytes) * 100)) : 100;
    config.onProgress({
      loaded: currentLoaded,
      total: totalBytes,
      percent,
      fileType
    });
  };

  const results: PresignedUploadResult[] = [];

  try {
    // 1. Upload Primary Recording Asset
    const primaryTarget = await config.getPresignedUrl(primaryContext);
    const primaryResult = await uploadBlobToPresignedTarget(primaryBlob, primaryTarget, {
      filename: primaryContext.filename,
      fileType: 'recording',
      signal,
      onProgress: (p) => {
        primaryLoaded = p.loaded;
        emitUnifiedProgress('recording');
      }
    });
    results.push(primaryResult);

    // 2. Upload Camera Asset if present
    if (cameraBlob && cameraContext) {
      const cameraTarget = await config.getPresignedUrl(cameraContext);
      const cameraResult = await uploadBlobToPresignedTarget(cameraBlob, cameraTarget, {
        filename: cameraContext.filename,
        fileType: 'camera',
        signal,
        onProgress: (p) => {
          cameraLoaded = p.loaded;
          emitUnifiedProgress('camera');
        }
      });
      results.push(cameraResult);
    }

    // Fire success callback for the primary asset (or latest)
    if (config.onSuccess && results.length > 0) {
      config.onSuccess(results[0]);
    }

    return results;
  } catch (err: any) {
    if (config.onError) {
      config.onError(err instanceof Error ? err : new Error(String(err)));
    }
    throw err;
  }
}
