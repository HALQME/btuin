import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { BufferPool } from "../packages/btuin/src/buffer/pool";
import { List, type ListItem } from "../packages/btuin/src/elements/list";
import type { Buffer2D } from "../packages/btuin/src/buffer/types";
import { Profiler } from "./profiler-core";

/**
 * Performance profiler for btuin package
 * Measures CPU time, memory usage, identifies hotspots, and tracks real-world load patterns
 * Run with: bun test scripts/profiler.spec.ts
 */

console.log("\n╔════════════════════════════════════════════════════════════╗");
console.log("║       btuin ADVANCED PERFORMANCE PROFILER REPORT           ║");
console.log("║      Real-World Load, Fragmentation & Scalability          ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

describe("Advanced Performance Profiler", () => {
  beforeEach(() => {
    Bun.gc(true);
  });

  describe("Frame simulation profiling", () => {
    let profiler: Profiler;
    let pool: BufferPool;
    let items: ListItem[];

    beforeEach(() => {
      profiler = new Profiler();
      pool = new BufferPool({
        rows: 24,
        cols: 80,
        initialSize: 20,
        maxSize: 100,
      });

      items = Array.from({ length: 5000 }, (_, i) => ({
        label: `Item ${i + 1}`,
        value: `${i + 1}`,
      }));
    });

    afterEach(() => {
      profiler.report();
    });

    it("profiles 60 FPS rendering simulation with List updates", () => {
      profiler.measureFrames(
        "60 FPS rendering loop (List with 5K items)",
        (frameNumber) => {
          List({
            items,
            focusKey: "frame-test",
            selected: frameNumber % items.length,
            itemHeight: 1,
            overscan: 2,
          });
        },
        60
      );

      const metrics = profiler.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);
      // Validate frame-based metrics exist
      const frameMetric = metrics.find((m) => m.p99Duration !== undefined);
      expect(frameMetric).toBeDefined();
    });

    it("profiles 1000 frame high-load rendering cycle", () => {
      profiler.measureFrames(
        "1000 frame intensive rendering",
        (frameNumber) => {
          const buf = pool.acquire();
          List({
            items,
            focusKey: `frame-${frameNumber}`,
            selected: Math.floor(Math.random() * items.length),
            itemHeight: 1,
            overscan: 3,
          });
          pool.release(buf);
        },
        1000
      );

      const frameMetrics = profiler.getFrameMetrics();
      expect(frameMetrics.length).toBeGreaterThanOrEqual(1000);

      // Validate tail latency metrics
      const tailFrames = frameMetrics.filter((f) => f.duration > 10); // > 10ms frames
      console.log(
        `   Tail frames (>10ms): ${tailFrames.length}/${frameMetrics.length}`
      );

      const metrics = profiler.getMetrics();
      const p99 = metrics.find((m) => m.p99Duration !== undefined);
      expect(p99?.p99Duration).toBeLessThan(100); // Reasonable tail latency
    });
  });

  describe("Memory fragmentation profiling", () => {
    let profiler: Profiler;
    let pool: BufferPool;

    beforeEach(() => {
      profiler = new Profiler();
      pool = new BufferPool({
        rows: 24,
        cols: 80,
        initialSize: 10,
        maxSize: 200,
      });
    });

    afterEach(() => {
      profiler.report();
    });

    it("profiles buffer pool fragmentation pattern (500 cycles)", () => {
      profiler.measureFragmentation(
        "BufferPool allocation/deallocation",
        () => {
          const buffers: Buffer2D[] = [];
          for (let i = 0; i < 50; i++) {
            buffers.push(pool.acquire());
          }
          return buffers;
        },
        (buffers) => {
          for (const buf of buffers) {
            pool.release(buf);
          }
        },
        500
      );

      const metrics = profiler.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);

      const fragMetric = metrics[metrics.length - 1];
      console.log(`   Peak memory: ${(fragMetric?.peakMemory! / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   Memory stability: ${fragMetric?.opsPerSecond.toFixed(0)} cycles/sec`);
    });

    it("profiles high-stress allocation pattern", () => {
      profiler.measureFragmentation(
        "High-stress buffer allocation",
        () => {
          const buffers: Buffer2D[] = [];
          // Varying allocation sizes to test fragmentation
          for (let i = 0; i < Math.random() * 100 + 50; i++) {
            buffers.push(pool.acquire());
          }
          return buffers;
        },
        (buffers) => {
          // Partial deallocation to simulate real-world patterns
          for (let i = 0; i < buffers.length / 2; i++) {
            pool.release(buffers[i]!);
          }
          // Keep some alive to test fragmentation
        },
        200
      );

      expect(profiler.getMetrics().length).toBeGreaterThan(0);
    });
  });

  describe("Scalability curve profiling", () => {
    let profiler: Profiler;
    let pool: BufferPool;

    beforeEach(() => {
      profiler = new Profiler();
      pool = new BufferPool({
        rows: 24,
        cols: 80,
        initialSize: 50,
        maxSize: 500,
      });
    });

    afterEach(() => {
      profiler.report();
    });

    it("profiles List scalability across item counts", () => {
      profiler.measureScalability(
        "List creation scalability",
        (size) => {
          const items: ListItem[] = Array.from({ length: size }, (_, i) => ({
            label: `Item ${i + 1}`,
            value: `${i + 1}`,
          }));

          List({
            items,
            focusKey: `scalability-${size}`,
            itemHeight: 1,
            overscan: 3,
          });
        },
        [1000, 5000, 10000, 50000, 100000]
      );

      const metrics = profiler.getMetrics();
      expect(metrics.length).toBeGreaterThanOrEqual(5);

      // Validate growth pattern (should be roughly linear)
      console.log("   Scalability growth pattern:");
      for (const metric of metrics) {
        const itemCount = parseInt(metric.name.match(/\d+/)?.[0] || "0");
        if (itemCount > 0) {
          console.log(
            `     ${itemCount} items: ${metric.duration.toFixed(2)}ms (${metric.opsPerSecond.toFixed(0)} ops/sec)`
          );
        }
      }
    });

    it("profiles BufferPool scalability with varying pool sizes", () => {
      profiler.measureScalability(
        "BufferPool acquire/release throughput",
        (size) => {
          const testPool = new BufferPool({
            rows: 24,
            cols: 80,
            initialSize: 10,
            maxSize: size,
          });

          for (let i = 0; i < 1000; i++) {
            const buf = testPool.acquire();
            testPool.release(buf);
          }
        },
        [50, 100, 200, 500]
      );

      expect(profiler.getMetrics().length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("Memory efficiency metrics", () => {
    let profiler: Profiler;

    beforeEach(() => {
      profiler = new Profiler();
    });

    afterEach(() => {
      profiler.report();
    });

    it("calculates ops-per-MB efficiency ratio", () => {
      const items = Array.from({ length: 10000 }, (_, i) => ({
        label: `Item ${i + 1}`,
        value: `${i + 1}`,
      }));

      profiler.measure(
        "List ops/MB efficiency",
        () => {
          for (let i = 0; i < 100; i++) {
            List({
              items,
              focusKey: `efficiency-${i}`,
              itemHeight: 1,
              overscan: 2,
            });
          }
        },
        100
      );

      const metric = profiler.getMetrics()[0];

      // Only validate efficiency if measurable memory delta occurred
      if (metric?.memoryDelta && metric.memoryDelta > 0) {
        if (metric.memoryEfficiency !== undefined) {
          console.log(
            `   Efficiency: ${metric.memoryEfficiency.toFixed(0)} operations per MB allocated`
          );
        }
        expect(metric.memoryEfficiency).toBeDefined();
      } else {
        console.log(
          `   Efficiency: Not measurable (delta: ${metric?.memoryDelta}B)`
        );
      }

      // Memory should be measured
      expect(metric?.memoryBefore).toBeDefined();
      expect(metric?.memoryAfter).toBeDefined();
    });

    it("tracks peak memory usage across operations", () => {
      const pool = new BufferPool({
        rows: 24,
        cols: 80,
        initialSize: 20,
        maxSize: 100,
      });

      const items = Array.from({ length: 50000 }, (_, i) => ({
        label: `Item ${i + 1}`,
        value: `${i + 1}`,
      }));

      profiler.measure(
        "Large list with pool operations",
        () => {
          const list = List({
            items,
            focusKey: "large-test",
            itemHeight: 1,
            overscan: 5,
          });

          for (let i = 0; i < 50; i++) {
            const buf = pool.acquire();
            pool.release(buf);
          }
        },
        1
      );

      const peakMemory = profiler.getPeakMemory();
      console.log(
        `   Peak memory: ${(peakMemory / 1024 / 1024).toFixed(2)}MB`
      );

      const metric = profiler.getMetrics()[0];
      console.log(
        `   Memory before: ${(metric?.memoryBefore! / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(
        `   Memory after: ${(metric?.memoryAfter! / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(
        `   Memory delta: ${(metric?.memoryDelta! / 1024 / 1024).toFixed(2)}MB`
      );

      expect(peakMemory).toBeGreaterThan(0);
      expect(metric?.memoryBefore).toBeDefined();
      expect(metric?.memoryAfter).toBeDefined();
    });
  });

  describe("Combined real-world scenarios", () => {
    let profiler: Profiler;
    let pool: BufferPool;

    beforeEach(() => {
      profiler = new Profiler();
      pool = new BufferPool({
        rows: 24,
        cols: 80,
        initialSize: 30,
        maxSize: 150,
      });
    });

    afterEach(() => {
      profiler.report();
    });

    it("profiles realistic TUI app workflow", () => {
      const items = Array.from({ length: 20000 }, (_, i) => ({
        label: `Item ${i + 1}`,
        value: `${i + 1}`,
      }));

      profiler.measureFrames(
        "Realistic TUI workflow",
        (frameNumber) => {
          // Simulate: render → handle input → update state → diffed render
          const list = List({
            items,
            focusKey: "tui-app",
            selected: frameNumber % items.length,
            itemHeight: 1,
            overscan: 4,
          });

          const buf = pool.acquire();
          pool.release(buf);
        },
        300 // 5 seconds at 60 FPS
      );

      const metrics = profiler.getMetrics();
      const lastMetric = metrics[metrics.length - 1];

      if (lastMetric?.p99Duration) {
        const fps60Target = 16.67; // ms per frame
        const exceeds = lastMetric.p99Duration > fps60Target;
        console.log(
          `   P99 vs 60FPS target: ${lastMetric.p99Duration.toFixed(2)}ms (${exceeds ? "⚠️ exceeds" : "✅ meets"} 16.67ms)`
        );
      }

      expect(profiler.getFrameMetrics().length).toBeGreaterThanOrEqual(300);
    });

    it("identifies bottlenecks under sustained load", () => {
      const items = Array.from({ length: 100000 }, (_, i) => ({
        label: `Item ${i + 1}`,
        value: `${i + 1}`,
      }));

      profiler.measure(
        "Sustained high-load rendering",
        () => {
          for (let cycle = 0; cycle < 50; cycle++) {
            const list = List({
              items,
              focusKey: `sustained-${cycle}`,
              selected: Math.floor(Math.random() * items.length),
              itemHeight: 1,
              overscan: 5,
            });

            // Simulate concurrent pool operations
            const buffers = [];
            for (let i = 0; i < 100; i++) {
              buffers.push(pool.acquire());
            }
            for (const buf of buffers) {
              pool.release(buf);
            }
          }
        },
        50
      );

      const metric = profiler.getMetrics()[0];
      const bottleneck = profiler.getSlowest();

      console.log(
        `   Average operation: ${(metric?.duration! / (metric?.operationCount ?? 1)).toFixed(2)}ms`
      );
      console.log(`   Bottleneck: ${bottleneck?.name}`);

      expect(metric?.opsPerSecond).toBeGreaterThan(0);
    });
  });
});
