import { describe, it, expect } from "bun:test";
import {
  BufferPool,
  getGlobalBufferPool,
  setGlobalBufferPool,
  resetGlobalBufferPool,
} from "../../src/buffer/pool";

describe("BufferPool", () => {
  it("acquires a buffer from the pool", () => {
    const pool = new BufferPool({ rows: 10, cols: 20, initialSize: 0 });
    const buffer = pool.acquire();

    expect(buffer).toBeDefined();
    expect(buffer.rows).toBe(10);
    expect(buffer.cols).toBe(20);
  });

  it("reuses buffers from the pool", () => {
    const pool = new BufferPool({ rows: 5, cols: 10, initialSize: 3 });

    expect(pool.getPoolSize()).toBe(3);

    const buffer1 = pool.acquire();
    expect(pool.getPoolSize()).toBe(2);

    pool.release(buffer1);
    expect(pool.getPoolSize()).toBe(3);
  });

  it("resets buffer content on acquire", () => {
    const pool = new BufferPool({ rows: 3, cols: 3, initialSize: 1 });
    const buffer = pool.acquire();

    // Modify the buffer
    const idx1 = buffer.index(0, 0);
    buffer.cells[idx1] = "X".codePointAt(0) ?? 32;
    buffer.fg[idx1] = "red";

    const idx2 = buffer.index(1, 1);
    buffer.cells[idx2] = "Y".codePointAt(0) ?? 32;
    buffer.bg[idx2] = "blue";

    pool.release(buffer);

    // Acquire again and check if it's reset
    const buffer2 = pool.acquire();
    const idx1b = buffer2.index(0, 0);
    const idx2b = buffer2.index(1, 1);

    expect(String.fromCodePoint(buffer2.cells[idx1b] || 32)).toBe(" ");
    expect(buffer2.fg[idx1b]).toBeUndefined();
    expect(String.fromCodePoint(buffer2.cells[idx2b] || 32)).toBe(" ");
    expect(buffer2.bg[idx2b]).toBeUndefined();
  });

  it("respects max pool size", () => {
    const pool = new BufferPool({ rows: 5, cols: 10, initialSize: 0, maxSize: 2 });

    const buf1 = pool.acquire();
    const buf2 = pool.acquire();
    const buf3 = pool.acquire();

    pool.release(buf1);
    expect(pool.getPoolSize()).toBe(1);

    pool.release(buf2);
    expect(pool.getPoolSize()).toBe(2);

    // This should not be added to pool (max size reached)
    pool.release(buf3);
    expect(pool.getPoolSize()).toBe(2);
  });

  it("creates new buffers when pool is empty", () => {
    const pool = new BufferPool({ rows: 5, cols: 10, initialSize: 0 });

    expect(pool.getPoolSize()).toBe(0);

    const buffer = pool.acquire();
    expect(buffer).toBeDefined();
    expect(buffer.rows).toBe(5);
    expect(buffer.cols).toBe(10);
  });

  it("provides pool configuration", () => {
    const pool = new BufferPool({ rows: 24, cols: 80, initialSize: 5, maxSize: 20 });
    const config = pool.getConfig();

    expect(config.rows).toBe(24);
    expect(config.cols).toBe(80);
    expect(config.currentSize).toBe(5);
    expect(config.maxSize).toBe(20);
  });

  it("clears all buffers from pool", () => {
    const pool = new BufferPool({ rows: 5, cols: 10, initialSize: 5 });

    expect(pool.getPoolSize()).toBe(5);

    pool.clear();
    expect(pool.getPoolSize()).toBe(0);
  });

  it("manages global buffer pool", () => {
    resetGlobalBufferPool();

    const globalPool1 = getGlobalBufferPool(10, 20);
    const globalPool2 = getGlobalBufferPool(10, 20);

    // Should return the same instance
    expect(globalPool1).toBe(globalPool2);

    const newPool = new BufferPool({ rows: 5, cols: 5, initialSize: 0 });
    setGlobalBufferPool(newPool);

    const globalPool3 = getGlobalBufferPool();
    expect(globalPool3).toBe(newPool);
  });

  it("initializes with correct number of buffers", () => {
    const pool = new BufferPool({ rows: 5, cols: 10, initialSize: 7 });
    expect(pool.getPoolSize()).toBe(7);
  });

  it("buffers are properly initialized with spaces", () => {
    const pool = new BufferPool({ rows: 3, cols: 4, initialSize: 1 });
    const buffer = pool.acquire();

    for (let row = 0; row < buffer.rows; row++) {
      for (let col = 0; col < buffer.cols; col++) {
        const idx = buffer.index(row, col);
        expect(String.fromCodePoint(buffer.cells[idx] || 32)).toBe(" ");
      }
    }
  });
});
