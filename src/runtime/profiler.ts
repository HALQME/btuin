import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import type { Buffer2D } from "../renderer/types";

export interface ProfileOptions {
  /**
   * Enable profiling.
   * @default false
   */
  enabled?: boolean;

  /**
   * Draw a small HUD overlay into the terminal output.
   * HUD uses the previous frame's metrics (so it doesn't perturb timings too much).
   * @default false
   */
  hud?: boolean;

  /**
   * Output file path to write JSON results on unmount.
   * When omitted, results are kept in memory only.
   */
  outputFile?: string;

  /**
   * Stop collecting after N frames (still flushes on unmount).
   * When exceeded, newer frames are ignored.
   */
  maxFrames?: number;

  /**
   * Collect a per-frame node count (walks the view tree each frame).
   * Useful for debugging but can be expensive for very large trees.
   * @default false
   */
  nodeCount?: boolean;
}

export interface FrameMetrics {
  id: number;
  time: number; // epoch ms
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
}

export interface ProfileOutput {
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
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx] ?? 0;
}

function tryMemoryUsage():
  | { rss: number; heapTotal: number; heapUsed: number; external: number }
  | undefined {
  try {
    const m = process.memoryUsage();
    return { rss: m.rss, heapTotal: m.heapTotal, heapUsed: m.heapUsed, external: m.external };
  } catch {
    return undefined;
  }
}

function tryByteLength(output: string): number {
  try {
    // Node/Bun compatible.
    return Buffer.byteLength(output, "utf8");
  } catch {
    return output.length;
  }
}

export class Profiler {
  readonly options: Required<Pick<ProfileOptions, "hud">> &
    Omit<ProfileOptions, "hud"> & { enabled: boolean; nodeCount: boolean };

  private startedAt = new Date();
  private frames: FrameMetrics[] = [];
  private frameSeq = 0;
  private lastFrame: FrameMetrics | null = null;

  constructor(options: ProfileOptions) {
    this.options = {
      enabled: options.enabled ?? false,
      hud: options.hud ?? false,
      outputFile: options.outputFile,
      maxFrames: options.maxFrames,
      nodeCount: options.nodeCount ?? false,
    };
  }

  isEnabled(): boolean {
    return this.options.enabled;
  }

  getFrames(): readonly FrameMetrics[] {
    return this.frames;
  }

  getLastFrame(): FrameMetrics | null {
    return this.lastFrame;
  }

  beginFrame(size: { rows: number; cols: number }, extra?: { nodeCount?: number }) {
    if (!this.options.enabled) return null;
    if (this.options.maxFrames !== undefined && this.frames.length >= this.options.maxFrames)
      return null;

    const id = ++this.frameSeq;
    return {
      id,
      time: Date.now(),
      rows: size.rows,
      cols: size.cols,
      nodeCount: extra?.nodeCount,
      t0: performance.now(),
      layoutMs: 0,
      renderMs: 0,
      diffMs: 0,
      writeMs: 0,
    };
  }

  endFrame(
    frame: null | {
      id: number;
      time: number;
      rows: number;
      cols: number;
      nodeCount?: number;
      t0: number;
      layoutMs: number;
      renderMs: number;
      diffMs: number;
      writeMs: number;
      outputBytes?: number;
      diffStats?: {
        changedCells: number;
        ops: number;
        cursorMoves: number;
        fgChanges: number;
        bgChanges: number;
        resets: number;
        fullRedraw: boolean;
      };
    },
  ) {
    if (!frame) return;

    const frameMs = performance.now() - frame.t0;
    const metrics: FrameMetrics = {
      id: frame.id,
      time: frame.time,
      rows: frame.rows,
      cols: frame.cols,
      nodeCount: frame.nodeCount,
      outputBytes: frame.outputBytes,
      diffCellsChanged: frame.diffStats?.changedCells,
      diffOps: frame.diffStats?.ops,
      diffCursorMoves: frame.diffStats?.cursorMoves,
      diffStyleChanges: frame.diffStats
        ? frame.diffStats.fgChanges + frame.diffStats.bgChanges
        : undefined,
      diffResets: frame.diffStats?.resets,
      diffFullRedraw: frame.diffStats?.fullRedraw,
      layoutMs: frame.layoutMs,
      renderMs: frame.renderMs,
      diffMs: frame.diffMs,
      writeMs: frame.writeMs,
      frameMs,
      memory: tryMemoryUsage(),
    };
    this.frames.push(metrics);
    this.lastFrame = metrics;
  }

  measure<T>(frame: any, key: "layoutMs" | "renderMs" | "diffMs" | "writeMs", fn: () => T): T {
    if (!frame) return fn();
    const t0 = performance.now();
    try {
      return fn();
    } finally {
      frame[key] += performance.now() - t0;
    }
  }

  recordOutput(frame: any, output: string) {
    if (!frame) return;
    frame.outputBytes = (frame.outputBytes ?? 0) + tryByteLength(output);
  }

  recordDiffStats(
    frame: any,
    stats: {
      changedCells: number;
      ops: number;
      cursorMoves: number;
      fgChanges: number;
      bgChanges: number;
      resets: number;
      fullRedraw: boolean;
    },
  ) {
    if (!frame) return;
    frame.diffStats = stats;
  }

  drawHud(buf: Buffer2D) {
    if (!this.options.enabled || !this.options.hud) return;
    const last = this.lastFrame;
    if (!last) return;

    const lines = [
      `frame ${last.frameMs.toFixed(2)}ms (L${last.layoutMs.toFixed(2)} R${last.renderMs.toFixed(2)} D${last.diffMs.toFixed(
        2,
      )} W${last.writeMs.toFixed(2)})`,
      `nodes ${last.nodeCount ?? "-"} bytes ${last.outputBytes ?? 0} diff ${last.diffCellsChanged ?? 0} ops ${last.diffOps ?? 0}`,
      last.memory
        ? `heap ${Math.round(last.memory.heapUsed / 1024 / 1024)}MB rss ${Math.round(last.memory.rss / 1024 / 1024)}MB`
        : "",
    ].filter(Boolean);

    const width = Math.min(buf.cols, Math.max(...lines.map((l) => l.length)) + 2);
    const height = Math.min(buf.rows, lines.length + 2);
    const x0 = Math.max(0, buf.cols - width);
    const y0 = 0;

    // simple box
    const fg = "white";
    const bg = "black";
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        buf.set(y0 + y, x0 + x, " ", { fg, bg });
      }
    }

    const top = "─";
    const side = "│";
    const tl = "┌";
    const tr = "┐";
    const bl = "└";
    const br = "┘";
    buf.set(y0, x0, tl, { fg, bg });
    buf.set(y0, x0 + width - 1, tr, { fg, bg });
    buf.set(y0 + height - 1, x0, bl, { fg, bg });
    buf.set(y0 + height - 1, x0 + width - 1, br, { fg, bg });
    for (let x = 1; x < width - 1; x++) {
      buf.set(y0, x0 + x, top, { fg, bg });
      buf.set(y0 + height - 1, x0 + x, top, { fg, bg });
    }
    for (let y = 1; y < height - 1; y++) {
      buf.set(y0 + y, x0, side, { fg, bg });
      buf.set(y0 + y, x0 + width - 1, side, { fg, bg });
    }

    // text
    for (let i = 0; i < lines.length && i < height - 2; i++) {
      const line = lines[i]!;
      for (let j = 0; j < Math.min(line.length, width - 2); j++) {
        buf.set(y0 + 1 + i, x0 + 1 + j, line[j]!, { fg, bg });
      }
    }
  }

  buildOutput(): ProfileOutput {
    const frameTimes = this.frames.map((f) => f.frameMs).sort((a, b) => a - b);
    const totals = this.frames.reduce(
      (acc, f) => {
        acc.layoutMs += f.layoutMs;
        acc.renderMs += f.renderMs;
        acc.diffMs += f.diffMs;
        acc.writeMs += f.writeMs;
        acc.frameMs += f.frameMs;
        return acc;
      },
      { layoutMs: 0, renderMs: 0, diffMs: 0, writeMs: 0, frameMs: 0 },
    );

    return {
      version: 1,
      startedAt: this.startedAt.toISOString(),
      endedAt: new Date().toISOString(),
      frames: [...this.frames],
      summary: {
        frameCount: this.frames.length,
        frameMs: {
          p50: percentile(frameTimes, 0.5),
          p95: percentile(frameTimes, 0.95),
          p99: percentile(frameTimes, 0.99),
          max: frameTimes.at(-1) ?? 0,
        },
        totals,
      },
    };
  }

  async flush(): Promise<void> {
    if (!this.options.enabled) return;
    if (!this.options.outputFile) return;

    const output = JSON.stringify(this.buildOutput(), null, 2);
    const dir = path.dirname(this.options.outputFile);
    if (dir && dir !== ".") {
      try {
        mkdirSync(dir, { recursive: true });
      } catch {}
    }
    await Bun.write(this.options.outputFile, output);
  }

  flushSync(): void {
    if (!this.options.enabled) return;
    if (!this.options.outputFile) return;
    const output = JSON.stringify(this.buildOutput(), null, 2);
    const dir = path.dirname(this.options.outputFile);
    if (dir && dir !== ".") {
      try {
        mkdirSync(dir, { recursive: true });
      } catch {}
    }
    try {
      writeFileSync(this.options.outputFile, output);
    } catch (error) {
      console.error("Failed to flush profiler results synchronously:", error);
    }
  }
}
