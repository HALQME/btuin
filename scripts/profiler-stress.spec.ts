import { test, describe, expect } from "bun:test";
import { existsSync } from "node:fs";

import { createApp, ref, Block, Text, type TerminalAdapter } from "../packages/btuin";
import { createNullTerminalAdapter, printSummary, type ProfilerLog } from "./profiler-core";

const n = 10_000;
const frames = 120;
const intervalMs = 16;
const hud = false;
const out = `profiles/stress-${Date.now()}.json`;

const tick = ref(0);
let resolveFinished: (() => void) | null = null;
const finished = new Promise<void>((resolve) => {
  resolveFinished = resolve;
});

// Pre-build a large, mostly-static tree to stress layout+render traversal.
const items = Array.from({ length: n }, (_, i) => Text(`item ${i}`).foreground("gray"));
const header = Text("stress").foreground("cyan");
const root = Block().direction("column");
root.add(header);
for (const item of items) root.add(item);

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

    return () => {
      header.content = `stress n=${n} tick=${tick.value}`;
      return root;
    };
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

describe("Profiler Stress Test", async () => {
  const appInstance = await app.mount();
  expect(appInstance.getComponent()).not.toBeNull();
  await finished;
  appInstance.unmount();
  expect(existsSync(out)).toBe(true);
  const log = (await import(`../${out}`, { with: { type: "json" } })) as ProfilerLog;
  printSummary(log);
  expect(log.summary.totals.frameMs / log.summary.frameCount).toBeLessThan(16.7);
  test("Average Frame Time < 33.4", () =>
    expect(log.summary.totals.frameMs / log.summary.frameCount).toBeLessThan(33.4));
  test("frameMs Max < 60", () => expect(log.summary.frameMs.max).toBeLessThan(60));
  test("framMs P99 < 20", () => expect(log.summary.frameMs.p99).toBeLessThan(20));
  test("frameMs P95 < 10", () => expect(log.summary.frameMs.p95).toBeLessThan(10));
  test("frameMs P50 < 5", () => expect(log.summary.frameMs.p50).toBeLessThan(5));
});
