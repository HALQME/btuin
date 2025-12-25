import { describe, expect, test } from "bun:test";
import { Block, Text } from "@/index";
import { createNullTerminalAdapter } from "./profiler-core";
import { createRenderer } from "@/runtime/render-loop";
import { FlatBuffer } from "@/renderer";
import { Profiler } from "@/runtime/profiler";
import { setDirtyVersions } from "@/view/dirty";
import { markLayoutDirty } from "@/view/dirty";

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------
const ITERATIONS = 5; // Number of times to repeat the test
const FRAMES = 160; // Total frames per run
const START_NODES = 0; // Initial nodes
const STEP_NODES = 200; // Nodes added per frame

type LimitFrame = { frameMs: number; nodeCount: number };

function runSingleIteration(iterationIndex: number): LimitFrame[] {
  setDirtyVersions({ layout: 0, render: 0 });

  const terminal = createNullTerminalAdapter({ rows: 40, cols: 120 });
  const profiler = new Profiler({
    enabled: true,
    // +1 for the priming renderOnce(true) below.
    maxFrames: FRAMES + 1,
    nodeCount: true,
  });

  let tick = 0;
  let nodeCount = START_NODES;

  const renderer = createRenderer({
    getSize: () => terminal.getTerminalSize(),
    write: terminal.write,
    view: () => {
      const root = Block().direction("column");
      const children: ReturnType<typeof Text>[] = [];
      children.length = nodeCount;
      for (let i = 0; i < nodeCount; i++) {
        children[i] = Text(`item ${i}`).foreground(i % 2 === 0 ? "white" : "gray");
      }

      root.children = children;
      root.children.unshift(Text(`Iter: ${iterationIndex} Frame: ${tick}`).foreground("cyan"));
      return root;
    },
    getState: () => ({}),
    handleError: (ctx) => {
      throw ctx.error;
    },
    profiler,
    deps: {
      FlatBuffer,
    },
  });

  // Prime once to establish retained tree and buffers.
  renderer.renderOnce(true);

  // Drive frames synchronously (no timer/coalescing artifacts).
  for (let i = 0; i < FRAMES; i++) {
    tick = i;
    nodeCount = START_NODES + i * STEP_NODES;
    // Ensure we actually measure layout + render + diff for scalability limits.
    markLayoutDirty();
    renderer.renderOnce(false);
  }

  renderer.dispose();

  // Drop the priming frame.
  const frames = profiler.getFrames().slice(1);
  return frames.map((f, idx) => ({
    frameMs: f.frameMs,
    nodeCount: START_NODES + idx * STEP_NODES,
  }));
}

function calculateStats(values: number[]) {
  if (values.length === 0) return { avg: 0, min: 0, max: 0, stdDev: 0 };

  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  const squaredDiffs = values.map((v) => Math.pow(v - avg, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(avgSquaredDiff);

  return { avg, min, max, stdDev };
}

describe("Scalability Limit Test (Statistical)", async () => {
  console.log(`\nStarting Statistical Stress Test (${ITERATIONS} iterations)`);

  const thresholds = [
    { fps: 120, ms: 8.33 },
    { fps: 60, ms: 16.66 },
    { fps: 30, ms: 33.33 },
    { fps: 15, ms: 66.66 },
  ];

  const results: Record<number, number[]> = {};
  thresholds.forEach((t) => (results[t.fps] = []));

  for (let i = 0; i < ITERATIONS; i++) {
    process.stdout.write(`  Run ${i + 1}/${ITERATIONS}... `);

    Bun.gc(true);

    const frames = runSingleIteration(i);
    const smoothedFrames = frames.map((frame, idx, all) => {
      const start = Math.max(0, idx - 2);
      const end = Math.min(all.length, idx + 3);
      const subset = all.slice(start, end);
      const avgMs = subset.reduce((sum, f) => sum + f.frameMs, 0) / subset.length;
      return { ...frame, avgMs };
    });

    const validFrames = smoothedFrames.slice(5);
    const maxNodes = START_NODES + (FRAMES - 1) * STEP_NODES;

    for (const t of thresholds) {
      expect(results[t.fps]).toBeDefined();
      const limitFrame = validFrames.find((f) => f.avgMs > t.ms);
      const limitNodeCount = limitFrame ? limitFrame.nodeCount : maxNodes;
      results[t.fps]!.push(limitNodeCount);
    }
    console.log(`Done.`);
  }

  console.log("\n" + "=".repeat(52));
  console.log(`${" ".repeat(10)}Performance Limits Report ${ITERATIONS} runs`);
  console.log("=".repeat(52));
  console.log(`| FPS Target | Avg Nodes |  Min  |  Max  | Std Dev |`);
  console.log(
    `|${"-".repeat(12)}|${"-".repeat(11)}|${"-".repeat(7)}|${"-".repeat(7)}|${"-".repeat(9)}|`,
  );

  for (const t of thresholds) {
    expect(results[t.fps]).toBeDefined();
    const stats = calculateStats(results[t.fps]!);
    const note = stats.avg >= START_NODES + (FRAMES - 1) * STEP_NODES ? "+" : "";

    console.log(
      `| ${t.fps.toString().padStart(3)} FPS    | ` +
        `${(Math.round(stats.avg) + note).toString().padEnd(9)} | ` +
        `${Math.round(stats.min).toString().padEnd(5)} | ` +
        `${Math.round(stats.max).toString().padEnd(5)} | ` +
        `±${Math.round(stats.stdDev).toString().padEnd(6)} |`,
    );
  }
  console.log("=".repeat(52));

  test("Stress test finished successfully", () => {
    expect(true).toBe(true);
  });
});
