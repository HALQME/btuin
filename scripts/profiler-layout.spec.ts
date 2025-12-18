import { test, describe, expect } from "bun:test";
import { existsSync } from "node:fs";

import { createApp, ref, Block, Text } from "@/index";
import { createNullTerminalAdapter, printSummary, type ProfilerLog } from "./profiler-core";

// This test intentionally mutates layout-relevant props every frame to stress:
// - view() construction cost
// - JS->WASM bridge (flattenTree + nodes array build)
// - WASM compute_layout cost
//
// It uses the same harness style as profiler-stress.test.ts (createApp + Profiler JSON output).

const N = 4_000;
const FRAMES = 120;
const INTERVAL_MS = 16;
const HUD = false;
const OUTPUT_FILE = `${import.meta.dirname}/profiles/layout-${Date.now()}.json`;

const tick = ref(0);
let resolveFinished: (() => void) | null = null;
const finished = new Promise<void>((resolve) => {
  resolveFinished = resolve;
});

// Reuse leaf Text nodes to avoid making this purely an allocation benchmark.
const leaves = Array.from({ length: N }, (_, i) => Text(`item ${i}`).foreground("gray"));

function buildTree(t: number) {
  const root = Block()
    .direction(t % 2 === 0 ? "column" : "row")
    .gap(t % 4)
    .padding((t % 3) as 0 | 1 | 2);

  root.add(Text(`layout-change-stress n=${N} tick=${t}`).foreground("cyan"));

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
  init() {
    let produced = 0;
    const timer = setInterval(() => {
      tick.value++;
      produced++;
      if (produced >= FRAMES) {
        clearInterval(timer);
        resolveFinished?.();
      }
    }, INTERVAL_MS);
    return {};
  },
  render() {
    return buildTree(tick.value);
  },
  terminal: createNullTerminalAdapter({ rows: 40, cols: 120 }),
  profile: {
    enabled: true,
    hud: HUD,
    outputFile: OUTPUT_FILE,
    maxFrames: FRAMES,
    nodeCount: true,
  },
});

describe("Many Layout Change Test", async () => {
  Bun.gc(true);
  await app.mount();
  expect(app.getComponent()).not.toBeNull();
  await finished;
  app.unmount();
  expect(existsSync(OUTPUT_FILE)).toBe(true);
  const log = (await import(OUTPUT_FILE, { with: { type: "json" } })) as ProfilerLog;
  printSummary(log);

  const frames = log.frames;
  const firstFrame = frames[0];
  const steadyFrames = frames.slice(5);

  test("Startup Latency (Frame 1) < 100ms", () => {
    expect(firstFrame).toBeDefined();
    expect(firstFrame!.frameMs).toBeLessThan(100);
  });

  test("Steady State Max (Frame 5+) < 33.4ms (30 FPS)", () => {
    const maxSteady = Math.max(...steadyFrames.map((f) => f.frameMs));
    expect(maxSteady).toBeLessThan(33.4);
  });

  test("Steady State Average < 30ms", () => {
    const avgSteady = steadyFrames.reduce((sum, f) => sum + f.frameMs, 0) / steadyFrames.length;
    expect(avgSteady).toBeLessThan(30);
  });
});
