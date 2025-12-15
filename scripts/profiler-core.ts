import type { TerminalAdapter } from "../packages/btuin/src/runtime";

type FrameMetrics = {
  id: number;
  time: number;
  rows: number;
  cols: number;
  nodeCount?: number;
  outputBytes?: number;
  diffCellsChanged?: number;
  diffOps?: number;
  diffCursorMoves?: number;
  diffStyleChanges?: number;
  diffResets?: number;
  diffFullRedraw?: boolean;
  layoutMs: number;
  renderMs: number;
  diffMs: number;
  writeMs: number;
  frameMs: number;
  memory?: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
};

export type ProfilerLog = {
  version: 1;
  startedAt: string;
  endedAt: string;
  frames: FrameMetrics[];
  summary: {
    frameCount: number;
    frameMs: { p50: number; p95: number; p99: number; max: number };
    totals: {
      layoutMs: number;
      renderMs: number;
      diffMs: number;
      writeMs: number;
      frameMs: number;
    };
  };
};

export function createNullTerminalAdapter(size: { rows: number; cols: number }): TerminalAdapter {
  return {
    setupRawMode() {},
    clearScreen() {},
    cleanupWithoutClear() {},
    patchConsole() {},
    startCapture() {},
    onKey() {},
    getTerminalSize() {
      return size;
    },
    disposeSingletonCapture() {},
    write() {},
  };
}

const formatMs = (value: number) => `${value.toFixed(2)}ms`;

function describeFrame(frame: FrameMetrics) {
  const diffCells = frame.diffCellsChanged ?? 0;
  const diffOps = frame.diffOps ?? 0;
  return `frame ${frame.id} → ${formatMs(frame.frameMs)} (layout ${formatMs(frame.layoutMs)}, render ${formatMs(
    frame.renderMs,
  )}, diff ${formatMs(frame.diffMs)}, write ${formatMs(frame.writeMs)}) diffCells=${diffCells} diffOps=${diffOps}`;
}

function summarizeFrames(frames: FrameMetrics[], key: keyof FrameMetrics, limit = 3) {
  return [...frames]
    .filter((frame) => typeof frame[key] === "number")
    .sort((a, b) => (b[key] as number) - (a[key] as number))
    .slice(0, limit);
}

function peakMemory(frames: FrameMetrics[]) {
  return frames.reduce(
    (acc, frame) => {
      if (frame.memory && frame.memory.heapUsed > acc.heapUsed) {
        acc.heapUsed = frame.memory.heapUsed;
        acc.frame = frame;
      }
      return acc;
    },
    { heapUsed: -Infinity, frame: null as FrameMetrics | null },
  );
}

export function printSummary(log: ProfilerLog) {
  const { frames } = log;
  const totals = log.summary.totals;
  const avgFrame = frames.length ? totals.frameMs / frames.length : 0;
  const renderShare = totals.frameMs ? (totals.renderMs / totals.frameMs) * 100 : 0;
  console.log("-".repeat(60));
  console.log(`Profile summary (${log.startedAt} → ${log.endedAt})`);
  console.log(`  total frames : ${log.summary.frameCount} (avg ${formatMs(avgFrame)})`);
  console.log(
    `  distribution : p50 ${formatMs(log.summary.frameMs.p50)}, p95 ${formatMs(
      log.summary.frameMs.p95,
    )}, p99 ${formatMs(log.summary.frameMs.p99)}, max ${formatMs(log.summary.frameMs.max)}`,
  );
  console.log(
    `  totals       : layout ${formatMs(totals.layoutMs)}, render ${formatMs(totals.renderMs)}, diff ${formatMs(
      totals.diffMs,
    )}, write ${formatMs(totals.writeMs)} (render share ${renderShare.toFixed(1)}%)`,
  );

  if (frames.length === 0) {
    console.log("  (no frames recorded)");
    return;
  }

  const [slowest, ...rest] = summarizeFrames(frames, "frameMs", 3);
  console.log("  spikes:");
  if (slowest) {
    console.log(`   - Slowest: ${describeFrame(slowest)}`);
  }
  rest.forEach((frame) => console.log(`   - ${describeFrame(frame)}`));

  const smallest = [...frames].sort((a, b) => a.frameMs - b.frameMs)[0];
  if (smallest) {
    console.log(`  smoothest: ${describeFrame(smallest)} (best frame)`);
  }

  const renderPeaks = summarizeFrames(frames, "renderMs", 3);
  console.log("  render bottlenecks:");
  renderPeaks.forEach((frame) => console.log(`   - ${describeFrame(frame)} (render-heavy)`));

  const layoutPeak = summarizeFrames(frames, "layoutMs", 1)[0];
  if (layoutPeak) {
    console.log(`  layout peak : frame ${layoutPeak.id} (${formatMs(layoutPeak.layoutMs)})`);
  }

  const diffPeak = summarizeFrames(frames, "diffCellsChanged", 1)[0];
  if (diffPeak && (diffPeak.diffCellsChanged ?? 0) > 0) {
    console.log(
      `  diff spike  : frame ${diffPeak.id}, ${diffPeak.diffCellsChanged} cells (${diffPeak.diffOps ?? 0} ops)`,
    );
  }

  const { frame: memFrame, heapUsed } = peakMemory(frames);
  if (memFrame) {
    console.log(
      `  memory peak : frame ${memFrame.id}, heapUsed ${Math.round(heapUsed / 1024 / 1024)}MB (rss ${Math.round(
        (memFrame.memory?.rss ?? 0) / 1024 / 1024,
      )}MB)`,
    );
  }

  console.log("  takeaways:");
  console.log(
    "   - Render is responsible for the biggest time slices; look into partial rendering or memoization.",
  );
  console.log(
    "   - Layout, diff, and write stay low, so efforts should focus on taming render-heavy spikes.",
  );
  console.log("-".repeat(60));
}
