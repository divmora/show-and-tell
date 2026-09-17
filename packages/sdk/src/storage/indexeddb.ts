import { 
  ChunkRecord, 
  SessionMetadata, 
  StoragePruneOptions, 
  StoragePruneResult, 
  StorageStats 
} from '../types';

const DB_NAME = 'ShowAndTell_DB';
const DB_VERSION = 1;
const SESSIONS_STORE = 'sessions';
const CHUNKS_STORE = 'chunks';

export const DEFAULT_MAX_STORAGE_BYTES = 300 * 1024 * 1024; // 300 MB
export const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

export class StorageManager {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    // Only initialize in browser environment
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.getDB();
    }
  }

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        return reject(new Error('IndexedDB is not supported in this environment'));
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
          const chunkStore = db.createObjectStore(CHUNKS_STORE, {
            keyPath: 'id',
            autoIncrement: true
          });
          chunkStore.createIndex('sessionId', 'sessionId', { unique: false });
          chunkStore.createIndex('sessionAndIndex', ['sessionId', 'index'], { unique: true });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  /**
   * Save new session metadata.
   */
  async createSession(metadata: SessionMetadata): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(SESSIONS_STORE, 'readwrite');
        const store = tx.objectStore(SESSIONS_STORE);
        const record: SessionMetadata = {
          totalBytes: 0,
          chunkCount: 0,
          ...metadata,
          updatedAt: metadata.updatedAt || Date.now()
        };
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[ShowAndTell] Failed to create session in IndexedDB:', err);
    }
  }

  /**
   * Update session metadata (elapsed time, status, etc.).
   */
  async updateSession(metadata: Partial<SessionMetadata> & { id: string }): Promise<void> {
    try {
      const db = await this.getDB();
      const existing = await this.getSession(metadata.id);
      if (!existing) return;

      const updated: SessionMetadata = {
        ...existing,
        ...metadata,
        updatedAt: Date.now()
      };

      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(SESSIONS_STORE, 'readwrite');
        const store = tx.objectStore(SESSIONS_STORE);
        const req = store.put(updated);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('[ShowAndTell] Failed to update session in IndexedDB:', err);
    }
  }

  /**
   * Save a single chunk slice.
   */
  async saveChunk(sessionId: string, index: number, blob: Blob, elapsedMs: number, timestamp: number = Date.now()): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction([CHUNKS_STORE, SESSIONS_STORE], 'readwrite');
        
        // Save chunk
        const chunkStore = tx.objectStore(CHUNKS_STORE);
        chunkStore.put({
          sessionId,
          index,
          blob,
          timestamp,
          elapsedMs
        });

        // Update session elapsed time, byte count, and chunk count
        const sessionStore = tx.objectStore(SESSIONS_STORE);
        const getReq = sessionStore.get(sessionId);
        getReq.onsuccess = () => {
          if (getReq.result) {
            const meta = getReq.result as SessionMetadata;
            meta.elapsedMs = elapsedMs;
            meta.updatedAt = timestamp;
            meta.totalBytes = (meta.totalBytes || 0) + (blob?.size || 0);
            meta.chunkCount = (meta.chunkCount || 0) + 1;
            sessionStore.put(meta);
          }
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[ShowAndTell] Failed to save chunk to IndexedDB:', err);
    }
  }

  /**
   * Retrieve a session by ID.
   */
  async getSession(sessionId: string): Promise<SessionMetadata | undefined> {
    const db = await this.getDB();
    return new Promise<SessionMetadata | undefined>((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, 'readonly');
      const store = tx.objectStore(SESSIONS_STORE);
      const req = store.get(sessionId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Retrieve all saved sessions in IndexedDB.
   */
  async getAllSessions(): Promise<SessionMetadata[]> {
    try {
      const db = await this.getDB();
      return new Promise<SessionMetadata[]>((resolve, reject) => {
        const tx = db.transaction(SESSIONS_STORE, 'readonly');
        const store = tx.objectStore(SESSIONS_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result || []) as SessionMetadata[]);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  /**
   * Calculate total size of chunks stored for a session.
   */
  async getSessionSize(sessionId: string): Promise<number> {
    try {
      const chunks = await this.getChunks(sessionId);
      return chunks.reduce((acc, c) => acc + (c.blob?.size || 0), 0);
    } catch {
      return 0;
    }
  }

  /**
   * Retrieve aggregate storage statistics across all stored sessions and chunks.
   */
  async getStorageStats(): Promise<StorageStats> {
    try {
      const allSessions = await this.getAllSessions();
      let totalBytes = 0;
      let chunkCount = 0;
      let oldestSessionTime: number | undefined;
      let newestSessionTime: number | undefined;

      for (const session of allSessions) {
        const t = session.updatedAt || session.startTime;
        if (oldestSessionTime === undefined || t < oldestSessionTime) oldestSessionTime = t;
        if (newestSessionTime === undefined || t > newestSessionTime) newestSessionTime = t;

        if (typeof session.totalBytes === 'number' && typeof session.chunkCount === 'number') {
          totalBytes += session.totalBytes;
          chunkCount += session.chunkCount;
        } else {
          const chunks = await this.getChunks(session.id);
          chunkCount += chunks.length;
          totalBytes += chunks.reduce((acc, c) => acc + (c.blob?.size || 0), 0);
        }
      }

      return {
        totalBytes,
        sessionCount: allSessions.length,
        chunkCount,
        oldestSessionTime,
        newestSessionTime
      };
    } catch {
      return {
        totalBytes: 0,
        sessionCount: 0,
        chunkCount: 0
      };
    }
  }

  /**
   * Automatically prune expired sessions older than maxAgeMs (default: 7 days)
   * and enforce maximum storage budget cap (default: 300 MB) via LRU eviction.
   */
  async pruneStorage(options: StoragePruneOptions = {}): Promise<StoragePruneResult> {
    const maxStorageBytes = options.maxStorageBytes ?? DEFAULT_MAX_STORAGE_BYTES;
    const maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
    const cutoffTime = options.cutoffTime ?? (Date.now() - maxAgeMs);

    const evictedSessionIds: string[] = [];
    let freedBytes = 0;
    let expiredCount = 0;
    let overBudgetCount = 0;

    try {
      const allSessions = await this.getAllSessions();
      if (allSessions.length === 0) {
        return {
          evictedSessionIds: [],
          freedBytes: 0,
          remainingBytes: 0,
          expiredCount: 0,
          overBudgetCount: 0
        };
      }

      // Compute size and timestamp for each session
      const sessionEntries = await Promise.all(
        allSessions.map(async (session) => {
          let size = session.totalBytes;
          if (typeof size !== 'number') {
            size = await this.getSessionSize(session.id);
          }
          const timestamp = session.updatedAt || session.startTime || 0;
          return { session, size, timestamp };
        })
      );

      // 1. TTL Expiration Phase (sessions older than cutoffTime)
      const validEntries: typeof sessionEntries = [];

      for (const entry of sessionEntries) {
        if (entry.timestamp < cutoffTime) {
          await this.deleteSession(entry.session.id);
          evictedSessionIds.push(entry.session.id);
          freedBytes += entry.size;
          expiredCount++;
        } else {
          validEntries.push(entry);
        }
      }

      // 2. Storage Budget Cap & LRU Eviction Phase
      let currentTotalBytes = validEntries.reduce((acc, e) => acc + e.size, 0);

      if (currentTotalBytes > maxStorageBytes) {
        // Sort ascending by timestamp (oldest / least recently used first)
        validEntries.sort((a, b) => a.timestamp - b.timestamp);

        while (currentTotalBytes > maxStorageBytes && validEntries.length > 0) {
          const oldest = validEntries.shift()!;
          await this.deleteSession(oldest.session.id);
          evictedSessionIds.push(oldest.session.id);
          freedBytes += oldest.size;
          overBudgetCount++;
          currentTotalBytes -= oldest.size;
        }
      }

      return {
        evictedSessionIds,
        freedBytes,
        remainingBytes: Math.max(0, currentTotalBytes),
        expiredCount,
        overBudgetCount
      };
    } catch (err) {
      console.warn('[ShowAndTell] Failed to prune storage in IndexedDB:', err);
      return {
        evictedSessionIds,
        freedBytes,
        remainingBytes: 0,
        expiredCount,
        overBudgetCount
      };
    }
  }

  /**
   * Find any unfinalized / interrupted sessions (from previous page reloads).
   */
  async getInterruptedSessions(): Promise<SessionMetadata[]> {
    try {
      const db = await this.getDB();
      return new Promise<SessionMetadata[]>((resolve, reject) => {
        const tx = db.transaction(SESSIONS_STORE, 'readonly');
        const store = tx.objectStore(SESSIONS_STORE);
        const req = store.getAll();
        req.onsuccess = () => {
          const all = (req.result || []) as SessionMetadata[];
          // Active or interrupted sessions that have chunks
          const interrupted = all.filter(s => s.status === 'active' || s.status === 'interrupted');
          resolve(interrupted);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  /**
   * Get all chunks for a session sorted in ascending index order.
   */
  async getChunks(sessionId: string): Promise<ChunkRecord[]> {
    const db = await this.getDB();
    return new Promise<ChunkRecord[]>((resolve, reject) => {
      const tx = db.transaction(CHUNKS_STORE, 'readonly');
      const store = tx.objectStore(CHUNKS_STORE);
      const index = store.index('sessionId');
      const req = index.getAll(IDBKeyRange.only(sessionId));

      req.onsuccess = () => {
        const chunks = (req.result || []) as ChunkRecord[];
        chunks.sort((a, b) => a.index - b.index);
        resolve(chunks);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Assembles all chunks of a session into a complete Blob.
   */
  async assembleSessionBlob(sessionId: string): Promise<{ blob: Blob; metadata: SessionMetadata; mimeType: string } | undefined> {
    const session = await this.getSession(sessionId);
    if (!session) return undefined;

    const chunks = await this.getChunks(sessionId);
    if (chunks.length === 0) return undefined;

    const mimeType = session.mimeType || 'video/webm';
    const blobParts = chunks.map(c => c.blob);
    const combinedBlob = new Blob(blobParts, { type: mimeType });

    return {
      blob: combinedBlob,
      metadata: session,
      mimeType
    };
  }

  /**
   * Delete session and all its chunks.
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction([SESSIONS_STORE, CHUNKS_STORE], 'readwrite');
        
        // Delete session metadata
        tx.objectStore(SESSIONS_STORE).delete(sessionId);

        // Delete all chunks for this session
        const chunkStore = tx.objectStore(CHUNKS_STORE);
        const index = chunkStore.index('sessionId');
        const req = index.openKeyCursor(IDBKeyRange.only(sessionId));

        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            chunkStore.delete(cursor.primaryKey);
            cursor.continue();
          }
        };

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[ShowAndTell] Failed to delete session from IndexedDB:', err);
    }
  }

  /**
   * Clear all sessions and chunks.
   */
  async clearAll(): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction([SESSIONS_STORE, CHUNKS_STORE], 'readwrite');
        tx.objectStore(SESSIONS_STORE).clear();
        tx.objectStore(CHUNKS_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[ShowAndTell] Failed to clear IndexedDB:', err);
    }
  }
}

export const storage = new StorageManager();
