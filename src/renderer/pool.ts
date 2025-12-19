import type { Buffer2D } from "./types";
import { FlatBuffer } from "./buffer";

/**
 * Object pool for Buffer2D instances to reduce GC pressure
 * and improve performance for applications with frequent buffer allocations.
 *
 * @example
 * ```typescript
 * const pool = new BufferPool({ rows: 24, cols: 80 });
 * const buf = pool.acquire();
 * // Use buf...
 * pool.release(buf);
 * ```
 */
export class BufferPool {
  private pool: Buffer2D[] = [];
  private readonly rows: number;
  private readonly cols: number;
  private readonly maxSize: number;

  /**
   * Creates a new BufferPool instance
   * @param config - Pool configuration
   * @param config.rows - Number of rows each buffer should have
   * @param config.cols - Number of columns each buffer should have
   * @param config.initialSize - Initial number of buffers to pre-allocate (default: 5)
   * @param config.maxSize - Maximum pool size before buffers are discarded (default: 50)
   */
  constructor(config: { rows: number; cols: number; initialSize?: number; maxSize?: number }) {
    this.rows = config.rows;
    this.cols = config.cols;
    this.maxSize = config.maxSize ?? 50;

    const initialSize = config.initialSize ?? 5;
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createBuffer());
    }
  }

  /**
   * Acquires a buffer from the pool, creating a new one if needed
   * @returns A Buffer2D instance ready for use
   */
  acquire(): Buffer2D {
    if (this.pool.length > 0) {
      const buffer = this.pool.pop()!;
      this.resetBuffer(buffer);
      return buffer;
    }
    return this.createBuffer();
  }

  /**
   * Clears and returns a buffer to the pool
   * @param buffer - The buffer to return to the pool
   */
  release(buffer: Buffer2D): void {
    // Only keep the buffer if pool hasn't reached max size
    if (this.pool.length < this.maxSize) {
      this.resetBuffer(buffer);
      this.pool.push(buffer);
    }
  }

  /**
   * Returns the current number of buffers in the pool
   */
  getPoolSize(): number {
    return this.pool.length;
  }

  /**
   * Clears all buffers from the pool
   */
  clear(): void {
    this.pool = [];
  }

  /**
   * Gets the configuration of this pool
   */
  getConfig(): {
    rows: number;
    cols: number;
    currentSize: number;
    maxSize: number;
  } {
    return {
      rows: this.rows,
      cols: this.cols,
      currentSize: this.pool.length,
      maxSize: this.maxSize,
    };
  }

  /**
   * Create a new buffer initialized with empty space characters.
   * With FlatBuffer-based Buffer2D, this simply constructs a new instance.
   */
  private createBuffer(): Buffer2D {
    return new FlatBuffer(this.rows, this.cols);
  }

  /**
   * Reset buffer to initial state (filled with spaces and cleared attributes).
   */
  private resetBuffer(buffer: Buffer2D): void {
    buffer.clear();
  }
}

/**
 * Global buffer pool instance for convenience
 */
let globalPool: BufferPool | null = null;
let globalPoolIsCustom = false;

/**
 * Gets or creates the global buffer pool with default settings
 */
export function getGlobalBufferPool(rows: number = 24, cols: number = 80): BufferPool {
  if (globalPool && !globalPoolIsCustom) {
    const config = globalPool.getConfig();
    if (config.rows !== rows || config.cols !== cols) {
      globalPool = null;
    }
  }
  if (!globalPool) {
    globalPool = new BufferPool({ rows, cols });
    globalPoolIsCustom = false;
  }
  return globalPool;
}

/**
 * Sets the global buffer pool instance
 */
export function setGlobalBufferPool(pool: BufferPool): void {
  globalPool = pool;
  globalPoolIsCustom = true;
}

/**
 * Resets the global buffer pool
 */
export function resetGlobalBufferPool(): void {
  globalPool = null;
  globalPoolIsCustom = false;
}
