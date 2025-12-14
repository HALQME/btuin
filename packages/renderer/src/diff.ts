import { write } from "@btuin/terminal";
import type { Buffer2D } from "./types";

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
 */
export function renderDiff(prev: Buffer2D, next: Buffer2D) {
  const rows = next.rows;
  const cols = next.cols;
  if (rows === 0 || cols === 0) return;

  // Check if buffer sizes match
  const sizeChanged = prev.rows !== rows || prev.cols !== cols;

  let currentFg: string | undefined;
  let currentBg: string | undefined;

  // Local output buffer to batch terminal writes
  const out: string[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;

      const nextCode = next.cells[idx] || 32;
      const prevCode = prev.cells[idx] || 32;

      const nextFg = next.fg[idx];
      const nextBg = next.bg[idx];
      const prevFg = prev.fg[idx];
      const prevBg = prev.bg[idx];

      // Force redraw all cells if size changed, otherwise check for differences
      if (sizeChanged || nextCode !== prevCode || nextFg !== prevFg || nextBg !== prevBg) {
        // Move cursor: \x1b[row;colH
        out.push(`\x1b[${r + 1};${c + 1}H`);

        if (nextFg !== currentFg) {
          if (nextFg === undefined) {
            out.push("\x1b[39m");
          } else {
            out.push(nextFg);
          }
          currentFg = nextFg;
        }
        if (nextBg !== currentBg) {
          if (nextBg === undefined) {
            out.push("\x1b[49m");
          } else {
            out.push(nextBg);
          }
          currentBg = nextBg;
        }

        out.push(String.fromCodePoint(nextCode));
      }
    }
  }

  if (currentFg !== undefined || currentBg !== undefined) {
    out.push("\x1b[0m");
  }

  if (out.length > 0) {
    write(out.join(""));
  }
}
