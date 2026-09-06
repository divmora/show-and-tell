export class EventEmitter<T extends Record<string, any[]> = Record<string, any[]>> {
  private listeners: Map<keyof T, Set<(...args: any[]) => void>> = new Map();

  on<K extends keyof T>(event: K, handler: (...args: T[K]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off<K extends keyof T>(event: K, handler: (...args: T[K]) => void): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit<K extends keyof T>(event: K, ...args: T[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      // Clone set to prevent issues if handlers modify listeners during emit
      Array.from(set).forEach(handler => {
        try {
          handler(...args);
        } catch (err) {
          console.error(`[ShowAndTell] Error in event handler for "${String(event)}":`, err);
        }
      });
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}
