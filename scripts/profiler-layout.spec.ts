import { test, describe, expect } from "bun:test";
import { existsSync } from "node:fs";

import { createApp, ref, Block, Text } from "../packages/btuin";
import { createNullTerminalAdapter, printSummary, type ProfilerLog } from "./profiler-core";

// This test intentionally mutates layout-relevant props every frame to stress:
// - view() construction cost
// - JS->WASM bridge (flattenTree + nodes array build)
// - WASM compute_layout cost
//
// It uses the same harness style as profiler-stress.test.ts (createApp + Profiler JSON output).

const n = 4_000;
const frames = 120;
const intervalMs = 16;
const hud = false;
const out = `profiles/layout-${Date.now()}.json`;

const tick = ref(0);
let resolveFinished: (() => void) | null = null;
const finished = new Promise<void>((resolve) => {
  resolveFinished = resolve;
});

// Reuse leaf Text nodes to avoid making this purely an allocation benchmark.
const leaves = Array.from({ length: n }, (_, i) => Text(`item ${i}`).foreground("gray"));

function buildTree(t: number) {
  const root = Block()
    .direction(t % 2 === 0 ? "column" : "row")
    .gap(t % 4)
    .padding((t % 3) as 0 | 1 | 2);

  root.add(Text(`layout-change-stress n=${n} tick=${t}`).foreground("cyan"));

  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i]!;
    // Wrap each leaf to force style changes to impact layout each frame.
    const box = Block()
      .direction(t % 3 === 0 ? "row" : "column")
      .padding(((t + i) % 2) as 0 | 1);

    // Vary width/height frequently to invalidate computed layout.
    if (t % 2 === 0) {
      box.width((i % 20) + 5);
      box.height(1);
      box.grow(((i + t) % 3) + 1);
      box.shrink(((i + t) % 2) + 1);
    } else {
      box.width("auto");
      box.height(1);
      box.grow(((i + t) % 2) + 1);
      box.shrink(((i + t) % 3) + 1);
    }

    box.add(leaf);
    root.add(box);
  }

  return root;
}

const app = createApp({
  setup() {
    let produced = 0;
    const timer = setInterval(() => {
      tick.value++;
      produced++;
      if (produced >= frames) {
        clearInterval(timer);
        resolveFinished?.();
      }
    }, intervalMs);

    return () => buildTree(tick.value);
  },
  terminal: createNullTerminalAdapter({ rows: 40, cols: 120 }),
  profile: {
    enabled: true,
    hud,
    outputFile: out,
    maxFrames: frames,
    nodeCount: true,
  },
});

describe("Layout Change Stress Test", () => {
  test(
    "should run without errors",
    async () => {
      const appInstance = await app.mount();
      expect(appInstance.getComponent()).not.toBeNull();
      await finished;
      appInstance.unmount();
      expect(existsSync(out)).toBe(true);
    },
    { timeout: 60_000 },
  );

  test("Performance Requirements", async () => {
    const log = await import(`../${out}`, { with: { type: "json" } }) as ProfilerLog
    printSummary(log);
    expect(log.summary.totals.frameMs / log.summary.frameCount).toBeLessThan(33.4)
    expect(log.summary.frameMs.max).toBeLessThan(50)
    expect(log.summary.frameMs.p99).toBeGreaterThan(33.4)
    expect(log.summary.frameMs.p95).toBeLessThan(30)
    expect(log.summary.frameMs.p50).toBeLessThan(25)
  });
});
