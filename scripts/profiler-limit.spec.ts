import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { Block, Text, createApp, ref } from "@/index";
import { createNullTerminalAdapter, type ProfilerLog } from "./profiler-core";

// ----------------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------------
const FRAMES = 300; // Total frames per run
const START_NODES = 0; // Initial nodes
const STEP_NODES = 100; // Nodes added per frame
const INTERVAL_MS = 2; // Update interval
const ITERATIONS = 5; // Number of times to repeat the test

const OUTPUT_FILE = `${import.meta.dirname}/profiles/limit-${Date.now()}.json`;

async function runSingleIteration(iterationIndex: number): Promise<ProfilerLog> {
  const tick = ref(0);
  let resolveFinished: (() => void) | null = null;
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });

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
      const count = START_NODES + tick.value * STEP_NODES;
      const root = Block().direction("column");

      const children: ReturnType<typeof Text>[] = [];
      children.length = count;
      for (let i = 0; i < count; i++) {
        children[i] = Text(`item ${i}`).foreground(i % 2 === 0 ? "white" : "gray");
      }
      root.children = children;

      root.children.unshift(
        Text(`Iter: ${iterationIndex} Frame: ${tick.value} | Nodes: ${count}`).foreground("cyan"),
      );
      return root;
    },
    terminal: createNullTerminalAdapter({ rows: 40, cols: 120 }),
    profile: {
      enabled: true,
      outputFile: OUTPUT_FILE,
      maxFrames: FRAMES,
      nodeCount: true,
    },
  });

  await app.mount();
  await finished;
  app.unmount();

  if (!existsSync(OUTPUT_FILE)) {
    throw new Error(`Profile output file not found: ${OUTPUT_FILE}`);
  }

  const fileContent = await Bun.file(OUTPUT_FILE).text();
  return JSON.parse(fileContent) as ProfilerLog;
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
    Bun.stdout.write(`  Run ${i + 1}/${ITERATIONS}... `);

    Bun.gc(true);

    const log = await runSingleIteration(i);

    const smoothedFrames = log.frames.map((frame, idx, all) => {
      const start = Math.max(0, idx - 2);
      const end = Math.min(all.length, idx + 3);
      const subset = all.slice(start, end);
      const avgMs = subset.reduce((sum, f) => sum + f.frameMs, 0) / subset.length;
      return { ...frame, avgMs, nodeCount: START_NODES + idx * STEP_NODES };
    });

    const validFrames = smoothedFrames.slice(5);

    for (const t of thresholds) {
      expect(results[t.fps]).toBeDefined();
      const limitFrame = validFrames.find((f) => f.avgMs > t.ms);
      const limitNodeCount = limitFrame ? limitFrame.nodeCount : START_NODES + FRAMES * STEP_NODES;

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
    const note = stats.avg >= START_NODES + FRAMES * STEP_NODES ? "+" : "";

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
