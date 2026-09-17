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

  it('prunes sessions older than 7 days TTL', async () => {
    const now = Date.now();
    const tenDaysAgo = now - (10 * 24 * 60 * 60 * 1000);
    const eightDaysAgo = now - (8 * 24 * 60 * 60 * 1000);
    const oneDayAgo = now - (1 * 24 * 60 * 60 * 1000);

    // Expired session 1 (10 days old)
    await storage.createSession({
      id: 'expired_1',
      startTime: tenDaysAgo,
      updatedAt: tenDaysAgo,
      mimeType: 'video/webm',
      elapsedMs: 5000,
      status: 'interrupted'
    });
    await storage.saveChunk('expired_1', 0, new Blob([new Uint8Array(500)]), 1000, tenDaysAgo);

    // Expired session 2 (8 days old)
    await storage.createSession({
      id: 'expired_2',
      startTime: eightDaysAgo,
      updatedAt: eightDaysAgo,
      mimeType: 'video/webm',
      elapsedMs: 5000,
      status: 'interrupted'
    });
    await storage.saveChunk('expired_2', 0, new Blob([new Uint8Array(300)]), 1000, eightDaysAgo);

    // Valid recent session (1 day old)
    await storage.createSession({
      id: 'valid_recent',
      startTime: oneDayAgo,
      updatedAt: oneDayAgo,
      mimeType: 'video/webm',
      elapsedMs: 5000,
      status: 'interrupted'
    });
    await storage.saveChunk('valid_recent', 0, new Blob([new Uint8Array(200)]), 1000, oneDayAgo);

    // Run auto-pruning with default 7-day TTL
    const result = await storage.pruneStorage();

    expect(result.expiredCount).toBe(2);
    expect(result.overBudgetCount).toBe(0);
    expect(result.evictedSessionIds).toEqual(expect.arrayContaining(['expired_1', 'expired_2']));
    expect(result.freedBytes).toBe(800);
    expect(result.remainingBytes).toBe(200);

    // Verify expired are deleted and valid remains
    expect(await storage.getSession('expired_1')).toBeUndefined();
    expect(await storage.getSession('expired_2')).toBeUndefined();
    expect(await storage.getSession('valid_recent')).toBeDefined();
    expect((await storage.getChunks('expired_1')).length).toBe(0);
    expect((await storage.getChunks('valid_recent')).length).toBe(1);
  });

  it('enforces storage budget cap via LRU eviction of oldest sessions', async () => {
    const now = Date.now();
    const t1 = now - 4000;
    const t2 = now - 3000;
    const t3 = now - 2000;
    const t4 = now - 1000;

    // 4 sessions, each 50 bytes (total 200 bytes)
    await storage.createSession({ id: 's1', startTime: t1, updatedAt: t1, mimeType: 'video/webm', elapsedMs: 1000, status: 'completed' });
    await storage.saveChunk('s1', 0, new Blob([new Uint8Array(50)]), 1000);

    await storage.createSession({ id: 's2', startTime: t2, updatedAt: t2, mimeType: 'video/webm', elapsedMs: 1000, status: 'completed' });
    await storage.saveChunk('s2', 0, new Blob([new Uint8Array(50)]), 1000);

    await storage.createSession({ id: 's3', startTime: t3, updatedAt: t3, mimeType: 'video/webm', elapsedMs: 1000, status: 'completed' });
    await storage.saveChunk('s3', 0, new Blob([new Uint8Array(50)]), 1000);

    await storage.createSession({ id: 's4', startTime: t4, updatedAt: t4, mimeType: 'video/webm', elapsedMs: 1000, status: 'completed' });
    await storage.saveChunk('s4', 0, new Blob([new Uint8Array(50)]), 1000);

    // Initial stats should show 200 bytes across 4 sessions
    const initialStats = await storage.getStorageStats();
    expect(initialStats.totalBytes).toBe(200);
    expect(initialStats.sessionCount).toBe(4);
    expect(initialStats.chunkCount).toBe(4);

    // Prune with budget cap of 110 bytes
    // To fit within 110 bytes from 200 bytes, oldest s1 (50b) and s2 (50b) must be evicted (leaving 100b <= 110b)
    const result = await storage.pruneStorage({
      maxStorageBytes: 110,
      maxAgeMs: 1000000 // Ensure none are TTL expired
    });

    expect(result.expiredCount).toBe(0);
    expect(result.overBudgetCount).toBe(2);
    expect(result.evictedSessionIds).toEqual(['s1', 's2']);
    expect(result.freedBytes).toBe(100);
    expect(result.remainingBytes).toBe(100);

    // Verify s1 and s2 deleted, s3 and s4 preserved
    expect(await storage.getSession('s1')).toBeUndefined();
    expect(await storage.getSession('s2')).toBeUndefined();
    expect(await storage.getSession('s3')).toBeDefined();
    expect(await storage.getSession('s4')).toBeDefined();

    // Stats updated
    const finalStats = await storage.getStorageStats();
    expect(finalStats.totalBytes).toBe(100);
    expect(finalStats.sessionCount).toBe(2);
    expect(finalStats.chunkCount).toBe(2);
  });

  it('handles empty database pruning safely', async () => {
    const result = await storage.pruneStorage();
    expect(result.evictedSessionIds).toEqual([]);
    expect(result.freedBytes).toBe(0);
    expect(result.remainingBytes).toBe(0);
    expect(result.expiredCount).toBe(0);
    expect(result.overBudgetCount).toBe(0);

    const stats = await storage.getStorageStats();
    expect(stats.totalBytes).toBe(0);
    expect(stats.sessionCount).toBe(0);
    expect(stats.chunkCount).toBe(0);
  });
});
