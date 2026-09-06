import { ChunkRecord, SessionMetadata } from '../types';

const DB_NAME = 'ShowAndTell_DB';
const DB_VERSION = 1;
const SESSIONS_STORE = 'sessions';
const CHUNKS_STORE = 'chunks';

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
        const req = store.put(metadata);
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
  async saveChunk(sessionId: string, index: number, blob: Blob, elapsedMs: number): Promise<void> {
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
          timestamp: Date.now(),
          elapsedMs
        });

        // Update session elapsed time
        const sessionStore = tx.objectStore(SESSIONS_STORE);
        const getReq = sessionStore.get(sessionId);
        getReq.onsuccess = () => {
          if (getReq.result) {
            const meta = getReq.result as SessionMetadata;
            meta.elapsedMs = elapsedMs;
            meta.updatedAt = Date.now();
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
