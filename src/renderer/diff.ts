import type { Buffer2D } from "./types";

export interface DiffStats {
  sizeChanged: boolean;
  fullRedraw: boolean;
  changedCells: number;
  cursorMoves: number;
  fgChanges: number;
  bgChanges: number;
  resets: number;
  scrollOps?: number;
  ops: number;
}

export interface RenderDiffOptions {
  /**
   * When provided, DECSTBM scroll optimization is only attempted within this band
   * (0-based inclusive rows). This prevents false-positive scrolling and reduces
   * detection overhead for UIs that do not use scroll regions.
   */
  scrollRegion?: { top: number; bottom: number };
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
 * @param options - Optional scroll/optimization hints
 */
export function renderDiff(
  prev: Buffer2D,
  next: Buffer2D,
  stats?: DiffStats,
  options?: RenderDiffOptions,
): string {
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
    stats.scrollOps = 0;
    stats.ops = 0;
  }

  const asciiFastPath = prev.isAsciiOnly() && next.isAsciiOnly();
  const hint = options?.scrollRegion;
  const allowAuto = process.env.BTUIN_DECSTBM_AUTO === "1";
  const scroll =
    !sizeChanged && process.env.BTUIN_DISABLE_DECSTBM !== "1" && (hint || allowAuto)
      ? detectVerticalScrollRegion(prev, next, asciiFastPath, hint)
      : null;
  const rowMap = scroll ? buildScrollRowMap(rows, scroll) : null;
  const scrollPrefix = scroll ? buildDecstbmScrollPrefix(scroll) : "";

  if (asciiFastPath) {
    const asciiOutput = renderDiffAscii(
      prev,
      next,
      rows,
      cols,
      sizeChanged,
      stats,
      rowMap,
      scrollPrefix,
    );
    if (stats) {
      stats.ops =
        stats.cursorMoves +
        stats.fgChanges +
        stats.bgChanges +
        stats.resets +
        (stats.scrollOps ?? 0);
    }
    return asciiOutput;
  }

  let currentFg: string | undefined;
  let currentBg: string | undefined;
  let styleDirty = false;

  // Local output buffer to batch terminal writes
  const out: string[] = [];
  if (scrollPrefix) {
    out.push(scrollPrefix);
    if (stats) stats.scrollOps = (stats.scrollOps ?? 0) + 5;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Avoid printing into the terminal's bottom-right cell, which can trigger
      // an implicit line wrap/scroll on some terminals.
      if (r === rows - 1 && c === cols - 1) continue;

      const idx = r * cols + c;
      const prevIdx = mapPrevIndex(rowMap, cols, r, c);

      const nextWidth = next.widths[idx];
      if (nextWidth === 0) continue;

      const prevWidth = prevIdx === -1 ? 1 : (prev.widths[prevIdx] ?? 0);
      const nextGlyphKey = next.glyphKeyAtIndex(idx);
      const prevGlyphKey = prevIdx === -1 ? 32 : prev.glyphKeyAtIndex(prevIdx);

      const nextFg = next.fg[idx];
      const nextBg = next.bg[idx];
      const prevFg = prevIdx === -1 ? undefined : prev.fg[prevIdx];
      const prevBg = prevIdx === -1 ? undefined : prev.bg[prevIdx];

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
    stats.ops =
      stats.cursorMoves + stats.fgChanges + stats.bgChanges + stats.resets + (stats.scrollOps ?? 0);
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
  rowMap?: Int32Array | null,
  scrollPrefix = "",
): string {
  const out: string[] = [];
  if (scrollPrefix) {
    out.push(scrollPrefix);
    if (stats) stats.scrollOps = (stats.scrollOps ?? 0) + 5;
  }
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

      const prevIdx = mapPrevIndex(rowMap, cols, r, c);
      const prevWidth = prevIdx === -1 ? 1 : (prev.widths[prevIdx] ?? 0);
      const prevCode = prevIdx === -1 ? 32 : (prev.codes[prevIdx] ?? 32);
      const nextCode = next.codes[idx] ?? 32;
      const nextFg = next.fg[idx];
      const nextBg = next.bg[idx];
      const prevFg = prevIdx === -1 ? undefined : prev.fg[prevIdx];
      const prevBg = prevIdx === -1 ? undefined : prev.bg[prevIdx];

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

type ScrollRegion = { top: number; bottom: number; delta: number };

function buildDecstbmScrollPrefix(region: ScrollRegion): string {
  const top = region.top + 1;
  const bottom = region.bottom + 1;
  const delta = region.delta;
  const scrollCmd = delta > 0 ? `\x1b[${delta}S` : `\x1b[${-delta}T`;
  // Reset SGR before scrolling so newly exposed lines are blank with default style.
  // Place the cursor inside the scroll region to maximize terminal compatibility.
  return `\x1b[0m\x1b[${top};${bottom}r\x1b[${top};1H${scrollCmd}\x1b[r`;
}

function buildScrollRowMap(rows: number, region: ScrollRegion): Int32Array {
  const map = new Int32Array(rows);
  for (let r = 0; r < rows; r++) map[r] = r;
  const top = region.top;
  const bottom = region.bottom;
  const delta = region.delta;

  if (delta > 0) {
    for (let r = top; r <= bottom; r++) {
      const source = r + delta;
      map[r] = source <= bottom ? source : -1;
    }
  } else {
    for (let r = top; r <= bottom; r++) {
      const source = r + delta;
      map[r] = source >= top ? source : -1;
    }
  }

  return map;
}

function mapPrevIndex(
  rowMap: Int32Array | null | undefined,
  cols: number,
  r: number,
  c: number,
): number {
  if (!rowMap) return r * cols + c;
  const sourceRow = rowMap[r] ?? -1;
  if (sourceRow < 0) return -1;
  return sourceRow * cols + c;
}

function detectVerticalScrollRegion(
  prev: Buffer2D,
  next: Buffer2D,
  asciiFastPath: boolean,
  hint?: { top: number; bottom: number },
): ScrollRegion | null {
  const rows = next.rows;
  const cols = next.cols;
  if (rows < 8) return null;

  if (hint) {
    const top = Math.max(0, Math.trunc(hint.top));
    const bottom = Math.min(rows - 1, Math.trunc(hint.bottom));
    if (bottom - top + 1 < 8) return null;
    return detectVerticalScrollWithinBand(prev, next, asciiFastPath, { top, bottom }, cols);
  }

  // Keep the search window small; typical scrolling moves a few lines at a time.
  const maxDelta = Math.min(5, rows - 1);
  const deltas: number[] = [];
  for (let d = 1; d <= maxDelta; d++) {
    deltas.push(d, -d);
  }

  const minMatchedRows = Math.max(6, Math.floor(rows * 0.35));
  const minRegionHeight = Math.max(7, Math.floor(rows * 0.4));

  let best:
    | {
        delta: number;
        matchStart: number;
        matchLen: number;
        regionTop: number;
        regionBottom: number;
      }
    | undefined;

  for (const delta of deltas) {
    let currentStart = -1;
    let currentLen = 0;

    const flush = () => {
      if (currentLen <= 0) return;
      if (currentLen < minMatchedRows) {
        currentStart = -1;
        currentLen = 0;
        return;
      }
      const matchStart = currentStart;
      const matchEnd = currentStart + currentLen - 1;
      const regionTop = delta > 0 ? matchStart : matchStart + delta;
      const regionBottom = delta > 0 ? matchEnd + delta : matchEnd;
      const regionHeight = regionBottom - regionTop + 1;
      if (regionTop < 0 || regionBottom >= rows) {
        currentStart = -1;
        currentLen = 0;
        return;
      }
      if (regionHeight < minRegionHeight) {
        currentStart = -1;
        currentLen = 0;
        return;
      }
      if (
        !best ||
        currentLen > best.matchLen ||
        (currentLen === best.matchLen && Math.abs(delta) < Math.abs(best.delta))
      ) {
        best = { delta, matchStart, matchLen: currentLen, regionTop, regionBottom };
      }
      currentStart = -1;
      currentLen = 0;
    };

    for (let r = 0; r < rows; r++) {
      const prevRow = r + delta;
      if (prevRow < 0 || prevRow >= rows) {
        flush();
        continue;
      }
      const equal = asciiFastPath
        ? rowsEqualAscii(prev, next, prevRow, r, cols)
        : rowsEqual(prev, next, prevRow, r, cols);
      if (equal) {
        if (currentStart === -1) currentStart = r;
        currentLen++;
      } else {
        flush();
      }
    }
    flush();
  }

  if (!best) return null;
  const region = { top: best.regionTop, bottom: best.regionBottom, delta: best.delta };
  // Avoid scrolling the entire screen unless it looks extremely confident;
  // full-screen scroll can be surprising with multiplexers or nonstandard terminals.
  const regionHeight = region.bottom - region.top + 1;
  if (region.top === 0 && region.bottom === rows - 1 && regionHeight < rows - 1) return null;
  return region;
}

function detectVerticalScrollWithinBand(
  prev: Buffer2D,
  next: Buffer2D,
  asciiFastPath: boolean,
  band: { top: number; bottom: number },
  cols: number,
): ScrollRegion | null {
  const bandHeight = band.bottom - band.top + 1;
  const maxDelta = Math.min(5, bandHeight - 1);
  if (maxDelta <= 0) return null;

  let bestDelta = 0;
  let bestMatches = 0;

  const deltas: number[] = [];
  for (let d = 1; d <= maxDelta; d++) deltas.push(d, -d);

  for (const delta of deltas) {
    const overlap = bandHeight - Math.abs(delta);
    if (overlap < 6) continue;

    let matched = 0;
    if (delta > 0) {
      for (let r = band.top; r <= band.bottom - delta; r++) {
        const equal = asciiFastPath
          ? rowsEqualAscii(prev, next, r + delta, r, cols)
          : rowsEqual(prev, next, r + delta, r, cols);
        if (equal) matched++;
      }
    } else {
      for (let r = band.top - delta; r <= band.bottom; r++) {
        const equal = asciiFastPath
          ? rowsEqualAscii(prev, next, r + delta, r, cols)
          : rowsEqual(prev, next, r + delta, r, cols);
        if (equal) matched++;
      }
    }

    const ratio = matched / overlap;
    const minMatched = Math.max(6, Math.floor(overlap * 0.75));
    if (matched < minMatched || ratio < 0.75) continue;

    if (
      matched > bestMatches ||
      (matched === bestMatches && Math.abs(delta) < Math.abs(bestDelta))
    ) {
      bestMatches = matched;
      bestDelta = delta;
    }
  }

  if (bestDelta === 0) return null;
  return { top: band.top, bottom: band.bottom, delta: bestDelta };
}

function rowsEqualAscii(
  prev: Buffer2D,
  next: Buffer2D,
  prevRow: number,
  nextRow: number,
  cols: number,
): boolean {
  const prevBase = prevRow * cols;
  const nextBase = nextRow * cols;
  for (let c = 0; c < cols; c++) {
    const pi = prevBase + c;
    const ni = nextBase + c;
    if ((prev.widths[pi] ?? 0) !== (next.widths[ni] ?? 0)) return false;
    if ((prev.codes[pi] ?? 32) !== (next.codes[ni] ?? 32)) return false;
    if (prev.fg[pi] !== next.fg[ni]) return false;
    if (prev.bg[pi] !== next.bg[ni]) return false;
  }
  return true;
}

function rowsEqual(
  prev: Buffer2D,
  next: Buffer2D,
  prevRow: number,
  nextRow: number,
  cols: number,
): boolean {
  const prevBase = prevRow * cols;
  const nextBase = nextRow * cols;
  for (let c = 0; c < cols; c++) {
    const pi = prevBase + c;
    const ni = nextBase + c;
    const pw = prev.widths[pi] ?? 0;
    const nw = next.widths[ni] ?? 0;
    if (pw !== nw) return false;
    if (prev.fg[pi] !== next.fg[ni]) return false;
    if (prev.bg[pi] !== next.bg[ni]) return false;
    if (nw === 0) {
      if ((prev.codes[pi] ?? 0) !== (next.codes[ni] ?? 0)) return false;
      continue;
    }
    const pk = prev.glyphKeyAtIndex(pi);
    const nk = next.glyphKeyAtIndex(ni);
    if (pk !== nk) return false;
  }
  return true;
}
