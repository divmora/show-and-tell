import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { StorageManager } from './indexeddb';
import { SessionMetadata } from '../types';

describe('StorageManager (IndexedDB)', () => {
  let storage: StorageManager;

  beforeEach(async () => {
    storage = new StorageManager();
    await storage.clearAll();
  });

  it('creates and retrieves session metadata', async () => {
    const session: SessionMetadata = {
      id: 'session_1',
      startTime: 1000,
      mimeType: 'video/webm',
      maxDurationMs: 60000,
      elapsedMs: 0,
      status: 'active',
      updatedAt: 1000
    };

    await storage.createSession(session);
    const retrieved = await storage.getSession('session_1');

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('session_1');
    expect(retrieved?.status).toBe('active');
    expect(retrieved?.maxDurationMs).toBe(60000);
  });

  it('saves chunks and updates elapsed time', async () => {
    const session: SessionMetadata = {
      id: 'session_2',
      startTime: 1000,
      mimeType: 'video/webm',
      elapsedMs: 0,
      status: 'active',
      updatedAt: 1000
    };

    await storage.createSession(session);

    const chunk1 = new Uint8Array([1, 2, 3]) as unknown as Blob;
    const chunk2 = new Uint8Array([4, 5, 6]) as unknown as Blob;

    await storage.saveChunk('session_2', 0, chunk1, 1000);
    await storage.saveChunk('session_2', 1, chunk2, 2000);

    const chunks = await storage.getChunks('session_2');
    expect(chunks.length).toBe(2);
    expect(chunks[0].index).toBe(0);
    expect(chunks[1].index).toBe(1);

    const updatedSession = await storage.getSession('session_2');
    expect(updatedSession?.elapsedMs).toBe(2000);
  });

  it('finds interrupted sessions and assembles combined Blob', async () => {
    const session: SessionMetadata = {
      id: 'session_interrupted',
      startTime: 1000,
      mimeType: 'video/webm',
      elapsedMs: 3000,
      status: 'interrupted',
      updatedAt: 4000
    };

    await storage.createSession(session);
    const chunkA = new Uint8Array([1, 2, 3, 4, 5]) as unknown as Blob;
    const chunkB = new Uint8Array([6, 7, 8, 9, 10]) as unknown as Blob;
    await storage.saveChunk('session_interrupted', 0, chunkA, 1000);
    await storage.saveChunk('session_interrupted', 1, chunkB, 2000);

    const interrupted = await storage.getInterruptedSessions();
    expect(interrupted.some(s => s.id === 'session_interrupted')).toBe(true);

    const chunks = await storage.getChunks('session_interrupted');
    expect(chunks.length).toBe(2);

    const assembled = await storage.assembleSessionBlob('session_interrupted');
    expect(assembled).toBeDefined();
    expect(assembled?.blob.size).toBe(10);
    expect(assembled?.mimeType).toBe('video/webm');
  });

  it('deletes session and all its associated chunks', async () => {
    await storage.createSession({
      id: 'to_delete',
      startTime: 1000,
      mimeType: 'video/webm',
      elapsedMs: 1000,
      status: 'completed',
      updatedAt: 1000
    });
    await storage.saveChunk('to_delete', 0, new Uint8Array([1]) as unknown as Blob, 1000);

    await storage.deleteSession('to_delete');

    const session = await storage.getSession('to_delete');
    const chunks = await storage.getChunks('to_delete');

    expect(session).toBeUndefined();
    expect(chunks.length).toBe(0);
  });
});
