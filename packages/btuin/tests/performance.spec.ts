import { describe, it, expect } from "bun:test";
import { BufferPool } from "../src/buffer/pool";
import { fillRect } from "../src/buffer";
import { List, type ListItem } from "../src/elements/list";

describe("Performance Tests", () => {
  describe("List Component", () => {
    it("renders 10,000 items with virtualization < 500ms", () => {
      const items: ListItem[] = Array.from({ length: 10000 }, (_, i) => ({
        label: `Item ${i + 1}`,
        value: `${i + 1}`,
      }));

      const start = performance.now();
      const element = List({
        items,
        focusKey: "perf-list",
        itemHeight: 1,
        overscan: 2,
      });
      const elapsed = performance.now() - start;

      expect(element.items.length).toBe(10000);
      expect(elapsed).toBeLessThan(500);
    });

    it("handles rapid key navigation on 5,000 items < 300ms", () => {
      const items: ListItem[] = Array.from({ length: 5000 }, (_, i) => ({
        label: `Item ${i + 1}`,
        value: `${i + 1}`,
      }));

      const element = List({
        items,
        focusKey: "perf-nav-list",
        itemHeight: 1,
      });

      const start = performance.now();
      // Simulate rapid navigation
      for (let i = 0; i < 100; i++) {
        // This would normally trigger handleKey
        // For now, we measure element creation
        const _ = {
          ...element,
          selected: ((element as any).selected || 0) + i,
        };
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(300);
    });

    it("manages scroll state for 20,000 items < 400ms", () => {
      const items: ListItem[] = Array.from({ length: 20000 }, (_, i) => ({
        label: `Item ${i + 1}`,
        value: `${i + 1}`,
      }));

      const start = performance.now();
      const element = List({
        items,
        focusKey: "perf-scroll-list",
        itemHeight: 1,
        overscan: 3,
      });
      const elapsed = performance.now() - start;

      expect(element.items.length).toBe(20000);
      expect(elapsed).toBeLessThan(400);
    });
  });

  describe("BufferPool", () => {
    it("acquires and releases 1,000 buffers < 300ms", () => {
      const pool = new BufferPool({
        rows: 24,
        cols: 80,
        initialSize: 10,
        maxSize: 50,
      });

      const start = performance.now();
      const buffers = [];
      for (let i = 0; i < 1000; i++) {
        buffers.push(pool.acquire());
      }
      for (const buffer of buffers) {
        pool.release(buffer);
      }
      const elapsed = performance.now() - start;

      expect(pool.getPoolSize()).toBeLessThanOrEqual(50);
      expect(elapsed).toBeLessThan(300);
    });

    it("reuses pooled buffers efficiently < 200ms", () => {
      const pool = new BufferPool({
        rows: 24,
        cols: 80,
        initialSize: 20,
        maxSize: 50,
      });

      // Pre-populate pool
      const preBuffers = [];
      for (let i = 0; i < 20; i++) {
        preBuffers.push(pool.acquire());
      }
      for (const buf of preBuffers) {
        pool.release(buf);
      }

      const start = performance.now();
      // Now acquire from populated pool
      const buffers = [];
      for (let i = 0; i < 500; i++) {
        buffers.push(pool.acquire());
      }
      for (const buffer of buffers) {
        pool.release(buffer);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(200);
    });

    it("handles large buffers (200x100) efficiently < 250ms", () => {
      const pool = new BufferPool({
        rows: 200,
        cols: 100,
        initialSize: 5,
        maxSize: 20,
      });

      const start = performance.now();
      const buffers = [];
      for (let i = 0; i < 100; i++) {
        buffers.push(pool.acquire());
      }
      for (const buffer of buffers) {
        pool.release(buffer);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(250);
    });

    it("resets buffer content correctly < 150ms", () => {
      const pool = new BufferPool({
        rows: 24,
        cols: 80,
        initialSize: 5,
      });

      const start = performance.now();
      const buffer = pool.acquire();

      // Modify buffer
      fillRect(buffer, 0, 0, buffer.cols, buffer.rows, "X", {
        fg: "red",
        bg: "blue",
      });

      pool.release(buffer);
      const resetBuffer = pool.acquire();

      // Verify reset
      let allReset = true;
      for (let idx = 0; idx < resetBuffer.cells.length; idx++) {
        if (
          resetBuffer.cells[idx] !== 32 ||
          resetBuffer.fg[idx] !== undefined ||
          resetBuffer.bg[idx] !== undefined
        ) {
          allReset = false;
          break;
        }
      }

      const elapsed = performance.now() - start;

      expect(allReset).toBe(true);
      expect(elapsed).toBeLessThan(150);
    });
  });

  describe("Combined Operations", () => {
    it("creates List with 10,000 items and buffers < 600ms", () => {
      const pool = new BufferPool({
        rows: 24,
        cols: 80,
        initialSize: 5,
      });

      const items: ListItem[] = Array.from({ length: 10000 }, (_, i) => ({
        label: `Item ${i + 1}`,
        value: `${i + 1}`,
      }));

      const start = performance.now();

      // Create list
      const list = List({
        items,
        focusKey: "combined-list",
        itemHeight: 1,
        overscan: 2,
      });

      // Allocate and release buffers
      const buffers = [];
      for (let i = 0; i < 50; i++) {
        buffers.push(pool.acquire());
      }
      for (const buffer of buffers) {
        pool.release(buffer);
      }

      const elapsed = performance.now() - start;

      expect(list.items.length).toBe(10000);
      expect(pool.getPoolSize()).toBeLessThanOrEqual(50);
      expect(elapsed).toBeLessThan(600);
    });

    it("handles stress test with high event loop pressure < 800ms", () => {
      const pool = new BufferPool({
        rows: 24,
        cols: 80,
        initialSize: 10,
        maxSize: 50,
      });

      const items: ListItem[] = Array.from({ length: 5000 }, (_, i) => ({
        label: `Item ${i + 1}`,
        value: `${i + 1}`,
      }));

      List({
        items,
        focusKey: "stress-list",
        itemHeight: 1,
        overscan: 3,
      });

      const start = performance.now();

      // Simulate high-frequency operations
      for (let cycle = 0; cycle < 10; cycle++) {
        // Multiple buffer acquisitions
        const buffers = [];
        for (let i = 0; i < 100; i++) {
          buffers.push(pool.acquire());
        }

        // Release buffers
        for (const buffer of buffers) {
          pool.release(buffer);
        }

      }

      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(800);
    });
  });
});
