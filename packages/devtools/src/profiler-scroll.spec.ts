import { test, describe, expect } from "bun:test";
import { existsSync } from "node:fs";

import { createApp, ref, Block, Text, ViewportSlice } from "@/index";
import { createNullTerminalAdapter, printSummary, type ProfilerLog } from "./profiler-core";

const N = 50_000;
const FRAMES = 120;
const INTERVAL_MS = 16;
const HUD = false;
const OUTPUT_FILE = `${import.meta.dirname}/profiles/scroll-${Date.now()}.json`;

const tick = ref(0);
let resolveFinished: (() => void) | null = null;
const finished = new Promise<void>((resolve) => {
  resolveFinished = resolve;
});

const items = Array.from({ length: N }, (_, i) => `item ${i}`);
const header = Text("scroll").foreground("cyan");

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
    const startIndex = tick.value % (N - 1);
    header.content = `scroll n=${N} start=${startIndex}`;

    const root = Block().direction("column");
    root.add(header);
    root.add(
      ViewportSlice({
        items,
        startIndex,
        viewportRows: 30,
        overscan: 2,
        keyPrefix: "items",
        renderItem: (item) => Text(item).foreground("gray"),
      }),
    );
    return root;
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

describe("Windowed Scroll Profiler", async () => {
  Bun.gc(true);
  await app.mount();
  expect(app.getComponent()).not.toBeNull();
  await finished;
  app.unmount();
  expect(existsSync(OUTPUT_FILE)).toBe(true);
  const log = (await import(OUTPUT_FILE, { with: { type: "json" } })) as ProfilerLog;
  printSummary(log);

  const frames = log.frames;
  const steadyFrames = frames.slice(5);

  test("Steady State Max (Frame 5+) < 16.7ms (60 FPS)", () => {
    const maxSteady = Math.max(...steadyFrames.map((f) => f.frameMs));
    expect(maxSteady).toBeLessThan(16.7);
  });
});
