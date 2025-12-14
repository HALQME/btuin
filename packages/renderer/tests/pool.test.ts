import { describe, it, expect, beforeEach } from "bun:test";
import {
  BufferPool,
  getGlobalBufferPool,
  setGlobalBufferPool,
  resetGlobalBufferPool,
} from "../src/pool";
import { FlatBuffer } from "../src/buffer";

describe("BufferPool", () => {
  const rows = 10;
  const cols = 20;

  it("should construct with an initial size", () => {
    const pool = new BufferPool({ rows, cols, initialSize: 3 });
    expect(pool.getPoolSize()).toBe(3);
    const config = pool.getConfig();
    expect(config.rows).toBe(rows);
    expect(config.cols).toBe(cols);
  });

  it("should acquire a buffer from the pool", () => {
    const pool = new BufferPool({ rows, cols, initialSize: 1 });
    const buf = pool.acquire();
    expect(buf).toBeInstanceOf(FlatBuffer);
    expect(buf.rows).toBe(rows);
    expect(buf.cols).toBe(cols);
    expect(pool.getPoolSize()).toBe(0);
  });

  it("should create a new buffer if the pool is empty", () => {
    const pool = new BufferPool({ rows, cols, initialSize: 0 });
    const buf = pool.acquire();
    expect(buf).toBeInstanceOf(FlatBuffer);
    expect(pool.getPoolSize()).toBe(0);
  });

  it("should release a buffer back to the pool", () => {
    const pool = new BufferPool({ rows, cols, initialSize: 0 });
    const buf = pool.acquire();
    pool.release(buf);
    expect(pool.getPoolSize()).toBe(1);
  });

  it("should not exceed max size", () => {
    const pool = new BufferPool({ rows, cols, initialSize: 1, maxSize: 1 });
    const buf1 = pool.acquire();
    const buf2 = new FlatBuffer(rows, cols);

    pool.release(buf1); // This one goes back in
    expect(pool.getPoolSize()).toBe(1);

    pool.release(buf2); // This one should be discarded
    expect(pool.getPoolSize()).toBe(1);
  });

  it("should clear the pool", () => {
    const pool = new BufferPool({ rows, cols, initialSize: 5 });
    pool.clear();
    expect(pool.getPoolSize()).toBe(0);
  });

  it("should reset buffer on acquire and release", () => {
    const pool = new BufferPool({ rows, cols, initialSize: 1 });
    const buf = pool.acquire();
    buf.set(0, 0, "X");

    pool.release(buf);

    const newBuf = pool.acquire();
    // The character should be reset to a space
    expect(newBuf.get(0, 0).char).toBe(" ");
  });
});

describe("Global BufferPool", () => {
  beforeEach(() => {
    resetGlobalBufferPool();
  });

  it("should get or create a global pool", () => {
    const pool1 = getGlobalBufferPool(10, 10);
    const pool2 = getGlobalBufferPool(10, 10);
    expect(pool1).toBe(pool2);
    expect(pool1).toBeInstanceOf(BufferPool);
  });

  it("should allow setting a custom global pool", () => {
    const customPool = new BufferPool({ rows: 5, cols: 5 });
    setGlobalBufferPool(customPool);
    const pool = getGlobalBufferPool();
    expect(pool).toBe(customPool);
  });

  it("should reset the global pool", () => {
    const pool1 = getGlobalBufferPool(10, 10);
    resetGlobalBufferPool();
    const pool2 = getGlobalBufferPool(10, 10);
    expect(pool1).not.toBe(pool2);
  });
});
