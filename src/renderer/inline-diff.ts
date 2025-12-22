import type { Buffer2D } from "./types";
import type { DiffStats } from "./diff";

export type InlineDiffRenderer = {
  renderDiff: (prev: Buffer2D, next: Buffer2D, stats?: DiffStats) => string;
  cleanup: () => string;
  getLineCount: () => number;
};

type CreateInlineDiffRendererOptions = {
  trimRight?: boolean;
};

export function createInlineDiffRenderer(
  options: CreateInlineDiffRendererOptions = {},
): InlineDiffRenderer {
  const trimRight = options.trimRight ?? true;
  let prevLines = 0;

  function cleanup(): string {
    if (prevLines === 0) return "";
    const out: string[] = [];
    if (prevLines > 1) out.push(`\x1b[${prevLines - 1}A\r`);
    for (let i = 0; i < prevLines; i++) {
      out.push("\x1b[2K\r");
      if (i < prevLines - 1) out.push("\r\n");
    }
    prevLines = 0;
    return out.join("");
  }

  function renderDiff(_prev: Buffer2D, next: Buffer2D, stats?: DiffStats): string {
    const nextLines = bufferToLines(next, { trimRight });
    const maxLines = Math.max(prevLines, nextLines.length);

    if (stats) {
      stats.sizeChanged = _prev.rows !== next.rows || _prev.cols !== next.cols;
      stats.fullRedraw = true;
      stats.changedCells = 0;
      stats.cursorMoves = 0;
      stats.fgChanges = 0;
      stats.bgChanges = 0;
      stats.resets = 0;
      stats.ops = 0;
    }

    const out: string[] = [];

    if (prevLines > 0) {
      // Cursor is left on the last rendered line; move back to the first line.
      if (prevLines > 1) out.push(`\x1b[${prevLines - 1}A\r`);
    }

    for (let i = 0; i < maxLines; i++) {
      out.push("\x1b[2K\r");
      if (i < nextLines.length) out.push(nextLines[i]!);
      // Avoid trailing newline so repeated renders don't scroll at the terminal bottom.
      if (i < maxLines - 1) out.push("\r\n");
    }

    prevLines = nextLines.length;
    return out.join("");
  }

  return {
    renderDiff,
    cleanup,
    getLineCount: () => prevLines,
  };
}

function bufferToLines(buffer: Buffer2D, options: { trimRight: boolean }): string[] {
  const { rows, cols } = buffer;
  if (rows === 0 || cols === 0) return [];

  const lastUsedRow = findLastUsedRow(buffer);
  if (lastUsedRow === -1) return [];

  const lines: string[] = [];

  for (let r = 0; r <= lastUsedRow; r++) {
    const parts: string[] = [];
    let currentFg: string | undefined;
    let currentBg: string | undefined;
    let styleDirty = false;

    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const width = buffer.widths[idx];
      if (width === 0) continue;

      const nextFg = buffer.fg[idx];
      const nextBg = buffer.bg[idx];

      if (nextFg !== currentFg) {
        parts.push(nextFg === undefined ? "\x1b[39m" : nextFg);
        currentFg = nextFg;
        styleDirty = true;
      }
      if (nextBg !== currentBg) {
        parts.push(nextBg === undefined ? "\x1b[49m" : nextBg);
        currentBg = nextBg;
        styleDirty = true;
      }

      parts.push(buffer.glyphStringAtIndex(idx));
    }

    if (styleDirty) parts.push("\x1b[0m");

    const line = parts.join("");
    lines.push(options.trimRight ? trimRightAnsiAware(line) : line);
  }

  return lines;
}

function findLastUsedRow(buffer: Buffer2D): number {
  const { rows, cols } = buffer;
  if (rows === 0 || cols === 0) return -1;

  for (let r = rows - 1; r >= 0; r--) {
    const rowStart = r * cols;
    const rowEnd = rowStart + cols;
    for (let idx = rowStart; idx < rowEnd; idx++) {
      const width = buffer.widths[idx];
      if (width === 0) continue;

      if (buffer.fg[idx] !== undefined || buffer.bg[idx] !== undefined) return r;

      if (buffer.extras.has(idx)) return r;

      const code = buffer.codes[idx] ?? 32;
      if (code !== 32) return r;
    }
  }
  return -1;
}

function trimRightAnsiAware(input: string): string {
  if (input === "") return input;

  // Keep ANSI sequences but trim trailing spaces that appear in plain text segments.
  let out = "";
  let i = 0;
  let pending = "";

  while (i < input.length) {
    const ch = input[i]!;
    if (ch === "\x1b" && input[i + 1] === "[") {
      // Flush pending (trimmed) before escape sequence.
      if (pending.length > 0) {
        out += pending.replace(/[ \t]+$/g, "");
        pending = "";
      }

      const start = i;
      i += 2;
      while (i < input.length) {
        const c = input[i]!;
        if ((c >= "A" && c <= "Z") || (c >= "a" && c <= "z")) {
          i++;
          break;
        }
        i++;
      }
      out += input.slice(start, i);
      continue;
    }

    pending += ch;
    i++;
  }

  if (pending.length > 0) {
    out += pending.replace(/[ \t]+$/g, "");
  }

  return out;
}
