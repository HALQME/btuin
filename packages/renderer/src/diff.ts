import type { Buffer2D } from "./types";

export interface DiffStats {
  sizeChanged: boolean;
  fullRedraw: boolean;
  changedCells: number;
  cursorMoves: number;
  fgChanges: number;
  bgChanges: number;
  resets: number;
  ops: number;
}

/**
 * Renders the difference between two buffers, only updating changed cells.
 * If buffer sizes differ (e.g., after terminal resize), forces a full redraw.
 *
 * This version assumes Buffer2D is a FlatBuffer-like structure with
 * contiguous cells arrays and rows/cols metadata, plus parallel fg/bg arrays.
 *
 * To reduce stdout write overhead, this function batches all terminal escape
 * sequences and characters into a local string buffer and performs a single
 * write() call at the end of the frame.
 *
 * @param prev - Previous buffer state
 * @param next - New buffer state to render
 * @param stats - Optional stats collector
 */
export function renderDiff(prev: Buffer2D, next: Buffer2D, stats?: DiffStats): string {
  const rows = next.rows;
  const cols = next.cols;
  if (rows === 0 || cols === 0) return "";

  // Check if buffer sizes match
  const sizeChanged = prev.rows !== rows || prev.cols !== cols;
  const fullRedraw = sizeChanged;

  if (stats) {
    stats.sizeChanged = sizeChanged;
    stats.fullRedraw = fullRedraw;
    stats.changedCells = 0;
    stats.cursorMoves = 0;
    stats.fgChanges = 0;
    stats.bgChanges = 0;
    stats.resets = 0;
    stats.ops = 0;
  }

  const asciiFastPath = prev.isAsciiOnly() && next.isAsciiOnly();
  if (asciiFastPath) {
    const asciiOutput = renderDiffAscii(prev, next, rows, cols, sizeChanged, stats);
    if (stats) {
      stats.ops = stats.cursorMoves + stats.fgChanges + stats.bgChanges + stats.resets;
    }
    return asciiOutput;
  }

  let currentFg: string | undefined;
  let currentBg: string | undefined;
  let styleDirty = false;

  // Local output buffer to batch terminal writes
  const out: string[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Avoid printing into the terminal's bottom-right cell, which can trigger
      // an implicit line wrap/scroll on some terminals.
      if (r === rows - 1 && c === cols - 1) continue;

      const idx = r * cols + c;

      const nextWidth = next.widths[idx];
      if (nextWidth === 0) continue;

      const prevWidth = prev.widths[idx] ?? 0;
      const nextGlyphKey = next.glyphKeyAtIndex(idx);
      const prevGlyphKey = prev.glyphKeyAtIndex(idx);

      const nextFg = next.fg[idx];
      const nextBg = next.bg[idx];
      const prevFg = prev.fg[idx];
      const prevBg = prev.bg[idx];

      const needsDraw =
        sizeChanged ||
        prevWidth !== nextWidth ||
        prevGlyphKey !== nextGlyphKey ||
        nextFg !== prevFg ||
        nextBg !== prevBg;

      if (needsDraw) {
        if (stats) {
          stats.changedCells++;
          stats.cursorMoves++;
        }
        // Move cursor: \x1b[row;colH
        out.push(`\x1b[${r + 1};${c + 1}H`);

        if (nextFg !== currentFg) {
          if (nextFg === undefined) {
            out.push("\x1b[39m");
          } else {
            out.push(nextFg);
          }
          currentFg = nextFg;
          styleDirty = true;
          if (stats) stats.fgChanges++;
        }
        if (nextBg !== currentBg) {
          if (nextBg === undefined) {
            out.push("\x1b[49m");
          } else {
            out.push(nextBg);
          }
          currentBg = nextBg;
          styleDirty = true;
          if (stats) stats.bgChanges++;
        }

        out.push(next.glyphStringAtIndex(idx));
      }
    }
  }

  if (styleDirty) {
    out.push("\x1b[0m");
    if (stats) stats.resets++;
  }

  if (stats) {
    stats.ops = stats.cursorMoves + stats.fgChanges + stats.bgChanges + stats.resets;
  }

  return out.length > 0 ? out.join("") : "";
}

function renderDiffAscii(
  prev: Buffer2D,
  next: Buffer2D,
  rows: number,
  cols: number,
  sizeChanged: boolean,
  stats?: DiffStats,
): string {
  const out: string[] = [];
  let currentFg: string | undefined;
  let currentBg: string | undefined;
  let styleDirty = false;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === rows - 1 && c === cols - 1) {
        continue;
      }

      const idx = r * cols + c;
      const nextWidth = next.widths[idx];
      if (nextWidth === 0) continue;

      const prevWidth = prev.widths[idx] ?? 0;
      const prevCode = prev.codes[idx] ?? 32;
      const nextCode = next.codes[idx] ?? 32;
      const nextFg = next.fg[idx];
      const nextBg = next.bg[idx];
      const prevFg = prev.fg[idx];
      const prevBg = prev.bg[idx];

      const needsDraw =
        sizeChanged ||
        prevWidth !== nextWidth ||
        prevCode !== nextCode ||
        nextFg !== prevFg ||
        nextBg !== prevBg;

      if (!needsDraw) continue;

      if (stats) {
        stats.changedCells++;
        stats.cursorMoves++;
      }
      out.push(`\x1b[${r + 1};${c + 1}H`);

      if (nextFg !== currentFg) {
        if (nextFg === undefined) {
          out.push("\x1b[39m");
        } else {
          out.push(nextFg);
        }
        currentFg = nextFg;
        styleDirty = true;
        if (stats) stats.fgChanges++;
      }
      if (nextBg !== currentBg) {
        if (nextBg === undefined) {
          out.push("\x1b[49m");
        } else {
          out.push(nextBg);
        }
        currentBg = nextBg;
        styleDirty = true;
        if (stats) stats.bgChanges++;
      }

      out.push(String.fromCharCode(nextCode));
    }
  }

  if (styleDirty) {
    out.push("\x1b[0m");
    if (stats) stats.resets++;
  }

  return out.length > 0 ? out.join("") : "";
}
