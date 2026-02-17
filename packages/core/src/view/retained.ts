export interface RetainedCacheOptions {
  /**
   * If true (default), entries not referenced during a frame are dropped on `endFrame()`.
   * Set false to retain entries indefinitely (you'll manage lifetime manually).
   */
  gc?: boolean;
}

export interface RetainedCache {
  beginFrame(): void;
  endFrame(): void;
  use<T>(key: string, factory: () => T): T;
  drop(key: string): void;
  clear(): void;
}

export function createRetainedCache(options: RetainedCacheOptions = {}): RetainedCache {
  const gc = options.gc ?? true;
  const cache = new Map<string, unknown>();
  let used: Set<string> | null = null;

  return {
    beginFrame() {
      used = gc ? new Set<string>() : null;
    },
    endFrame() {
      if (!used) return;
      for (const key of cache.keys()) {
        if (!used.has(key)) cache.delete(key);
      }
      used = null;
    },
    use<T>(key: string, factory: () => T): T {
      if (!key) throw new Error("RetainedCache.use(key): key is required.");
      if (used) used.add(key);
      const existing = cache.get(key) as T | undefined;
      if (existing !== undefined) return existing;
      const created = factory();
      cache.set(key, created);
      return created;
    },
    drop(key: string) {
      cache.delete(key);
    },
    clear() {
      cache.clear();
    },
  };
}
