import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseResponseHeaders,
  extractErrorMessage,
  uploadBlobToPresignedTarget,
  uploadRecordingAssets
} from './uploader';
import { PresignedUrlTarget, PresignedUploadContext, PresignedUploadConfig } from '../types';

describe('Uploader Utilities', () => {
  describe('parseResponseHeaders', () => {
    it('parses valid raw header string into lowercase dictionary', () => {
      const raw = 'ETag: "abcd123"\r\nContent-Type: text/plain\r\nx-amz-request-id: 998877';
      const parsed = parseResponseHeaders(raw);
      expect(parsed).toEqual({
        etag: '"abcd123"',
        'content-type': 'text/plain',
        'x-amz-request-id': '998877'
      });
    });

    it('handles empty or blank header strings safely', () => {
      expect(parseResponseHeaders('')).toEqual({});
      expect(parseResponseHeaders('   ')).toEqual({});
    });
  });

  describe('extractErrorMessage', () => {
    it('extracts S3/R2 XML error code and message', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Error>
  <Code>AccessDenied</Code>
  <Message>Request has expired</Message>
  <RequestId>XYZ123</RequestId>
</Error>`;
      const msg = extractErrorMessage(403, 'Forbidden', xml);
      expect(msg).toBe('Storage error: Request has expired (AccessDenied)');
    });

    it('extracts JSON error message if present', () => {
      const json = JSON.stringify({ message: 'Invalid signed URL token' });
      const msg = extractErrorMessage(401, 'Unauthorized', json);
      expect(msg).toBe('Invalid signed URL token');
    });

    it('falls back to status code and status text if body is generic or empty', () => {
      const msg = extractErrorMessage(500, 'Internal Server Error', '');
      expect(msg).toBe('Upload failed with HTTP 500: Internal Server Error');
    });
  });

  describe('uploadBlobToPresignedTarget', () => {
    let mockXhrInstances: any[] = [];
    const originalXHR = globalThis.XMLHttpRequest;

    beforeEach(() => {
      mockXhrInstances = [];

      // Create a comprehensive mock XMLHttpRequest constructor
      const MockXMLHttpRequest = function (this: any) {
        this.open = vi.fn((method: string, url: string) => {
          this._method = method;
          this._url = url;
        });
        this.setRequestHeader = vi.fn((header: string, value: string) => {
          this._headers = this._headers || {};
          this._headers[header.toLowerCase()] = value;
        });
        this.send = vi.fn((payload: any) => {
          this._payload = payload;
        });
        this.abort = vi.fn(() => {
          if (this.onabort) this.onabort();
        });
        this.getAllResponseHeaders = vi.fn(() => 'ETag: "res-123"\r\nx-amz-id-2: 456');
        this.upload = {
          onprogress: null as any
        };
        this.status = 200;
        this.statusText = 'OK';
        this.responseText = '';
        this.onload = null as any;
        this.onerror = null as any;
        this.ontimeout = null as any;
        this.onabort = null as any;

        mockXhrInstances.push(this);
      } as any;

      globalThis.XMLHttpRequest = MockXMLHttpRequest;
    });

    afterEach(() => {
      globalThis.XMLHttpRequest = originalXHR;
    });

    it('performs HTTP PUT upload with progress reporting and succeeds on 200', async () => {
      const blob = new Blob(['hello world video content'], { type: 'video/webm' });
      const target: PresignedUrlTarget = {
        url: 'https://s3.amazonaws.com/my-bucket/video.webm',
        method: 'PUT',
        headers: {
          'x-amz-acl': 'public-read'
        },
        publicUrl: 'https://cdn.example.com/video.webm'
      };

      const progressEvents: any[] = [];
      const uploadPromise = uploadBlobToPresignedTarget(blob, target, {
        filename: 'video.webm',
        onProgress: (p) => progressEvents.push(p)
      });

      expect(mockXhrInstances.length).toBe(1);
      const xhr = mockXhrInstances[0];
      expect(xhr.open).toHaveBeenCalledWith('PUT', target.url, true);
      expect(xhr.setRequestHeader).toHaveBeenCalledWith('x-amz-acl', 'public-read');
      expect(xhr.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'video/webm');
      expect(xhr.send).toHaveBeenCalledWith(blob);

      // Simulate progress
      if (xhr.upload.onprogress) {
        xhr.upload.onprogress({
          lengthComputable: true,
          loaded: 12,
          total: 24
        } as ProgressEvent);
      }

      expect(progressEvents.length).toBe(1);
      expect(progressEvents[0].percent).toBe(50);

      // Finish upload
      xhr.status = 200;
      xhr.onload();

      const result = await uploadPromise;
      expect(result.status).toBe(200);
      expect(result.publicUrl).toBe('https://cdn.example.com/video.webm');
      expect(result.headers['etag']).toBe('"res-123"');
      // Should have emitted 100% on completion
      expect(progressEvents[progressEvents.length - 1].percent).toBe(100);
    });

    it('performs S3 Presigned POST multipart upload and succeeds on 204 No Content', async () => {
      const blob = new Blob(['s3 post content'], { type: 'video/mp4' });
      const target: PresignedUrlTarget = {
        url: 'https://s3.amazonaws.com/my-bucket',
        method: 'POST',
        fields: {
          key: 'uploads/test.mp4',
          bucket: 'my-bucket',
          policy: 'base64policy=='
        }
      };

      const uploadPromise = uploadBlobToPresignedTarget(blob, target, {
        filename: 'test.mp4'
      });

      const xhr = mockXhrInstances[0];
      expect(xhr.open).toHaveBeenCalledWith('POST', target.url, true);
      expect(xhr._payload).toBeInstanceOf(FormData);

      xhr.status = 204;
      xhr.statusText = 'No Content';
      xhr.onload();

      const result = await uploadPromise;
      expect(result.status).toBe(204);
    });

    it('rejects with descriptive error when storage returns HTTP 403 Access Denied', async () => {
      const blob = new Blob(['data']);
      const target: PresignedUrlTarget = { url: 'https://s3.amazonaws.com/test' };

      const uploadPromise = uploadBlobToPresignedTarget(blob, target);
      const xhr = mockXhrInstances[0];

      xhr.status = 403;
      xhr.statusText = 'Forbidden';
      xhr.responseText = '<Error><Code>RequestTimeTooSkewed</Code><Message>The difference between the request time and the current time is too large.</Message></Error>';
      xhr.onload();

      await expect(uploadPromise).rejects.toThrow('Storage error: The difference between the request time and the current time is too large. (RequestTimeTooSkewed)');
    });

    it('handles network failure (CORS / connectivity issue)', async () => {
      const blob = new Blob(['data']);
      const target: PresignedUrlTarget = { url: 'https://s3.amazonaws.com/test' };

      const uploadPromise = uploadBlobToPresignedTarget(blob, target);
      const xhr = mockXhrInstances[0];
      xhr.onerror();

      await expect(uploadPromise).rejects.toThrow(/Network error occurred/);
    });

    it('aborts upload when AbortSignal triggers', async () => {
      const controller = new AbortController();
      const blob = new Blob(['data']);
      const target: PresignedUrlTarget = { url: 'https://s3.amazonaws.com/test' };

      const uploadPromise = uploadBlobToPresignedTarget(blob, target, {
        signal: controller.signal
      });

      const xhr = mockXhrInstances[0];
      controller.abort();

      expect(xhr.abort).toHaveBeenCalled();
      await expect(uploadPromise).rejects.toThrow(/cancelled|aborted/i);
    });
  });

  describe('uploadRecordingAssets', () => {
    let mockXhrInstances: any[] = [];
    const originalXHR = globalThis.XMLHttpRequest;

    beforeEach(() => {
      mockXhrInstances = [];
      const MockXMLHttpRequest = function (this: any) {
        this.open = vi.fn();
        this.setRequestHeader = vi.fn();
        this.send = vi.fn(() => {
          setTimeout(() => {
            this.status = 200;
            if (this.onload) this.onload();
          }, 0);
        });
        this.getAllResponseHeaders = vi.fn(() => 'ETag: "123"');
        this.upload = { onprogress: null as any };
        mockXhrInstances.push(this);
      } as any;
      globalThis.XMLHttpRequest = MockXMLHttpRequest;
    });

    afterEach(() => {
      globalThis.XMLHttpRequest = originalXHR;
    });

    it('orchestrates multi-asset upload for recording and camera bubble', async () => {
      const primaryBlob = new Blob(['main-screen-data-12345'], { type: 'video/webm' });
      const cameraBlob = new Blob(['camera-bubble-data-67890'], { type: 'video/webm' });

      const primaryContext: PresignedUploadContext = {
        id: 'sess-1',
        filename: 'recording.webm',
        mimeType: 'video/webm',
        size: primaryBlob.size,
        duration: 10,
        mode: 'pixel',
        fileType: 'recording'
      };

      const cameraContext: PresignedUploadContext = {
        id: 'sess-1',
        filename: 'camera_sess-1.webm',
        mimeType: 'video/webm',
        size: cameraBlob.size,
        duration: 10,
        mode: 'pixel',
        fileType: 'camera'
      };

      const getPresignedUrl = vi.fn(async (ctx: PresignedUploadContext) => ({
        url: `https://storage.example.com/${ctx.filename}`,
        method: 'PUT' as const,
        publicUrl: `https://cdn.example.com/${ctx.filename}`
      }));

      const progressReports: any[] = [];
      const onProgress = vi.fn((p) => progressReports.push(p));
      const onSuccess = vi.fn();

      const config: PresignedUploadConfig = {
        getPresignedUrl,
        onProgress,
        onSuccess
      };

      const results = await uploadRecordingAssets({
        primaryBlob,
        primaryContext,
        cameraBlob,
        cameraContext,
        config
      });

      expect(results.length).toBe(2);
      expect(getPresignedUrl).toHaveBeenCalledTimes(2);
      expect(onSuccess).toHaveBeenCalledWith(results[0]);
      expect(progressReports.length).toBeGreaterThanOrEqual(2);
      expect(progressReports[progressReports.length - 1].percent).toBe(100);
    });
  });
});
