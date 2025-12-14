import { describe, it, expect, mock, beforeEach } from "bun:test";
import { renderDiff } from "../src/diff";
import { FlatBuffer } from "../src/buffer";
import type { Buffer2D } from "../src/types";
import type { DiffStats } from "../src/diff";

function setCharAt(buf: Buffer2D, idx: number, ch: string) {
  const row = Math.floor(idx / buf.cols);
  const col = idx % buf.cols;
  buf.set(row, col, ch);
}

// Helper to create a mock buffer
function createMockBuffer(
  rows: number,
  cols: number,
  fillChar = " ",
  fg?: string,
  bg?: string,
): Buffer2D {
  const buf = new FlatBuffer(rows, cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      buf.set(r, c, fillChar);
    }
  }
  buf.fg.fill(fg);
  buf.bg.fill(bg);
  return buf;
}

describe("renderDiff", () => {
  beforeEach(() => {});

  it("should not write anything if buffers are identical", () => {
    const prev = createMockBuffer(2, 2, "a");
    const next = createMockBuffer(2, 2, "a");
    const output = renderDiff(prev, next);
    expect(output).toBe("");
  });

  it("should render only the changed cells", () => {
    const prev = createMockBuffer(2, 2, "a");
    const next = createMockBuffer(2, 2, "a");
    setCharAt(next, 2, "b");
    next.fg[2] = "\x1b[31m"; // red

    const output = renderDiff(prev, next);

    // Expected output:
    // 1. Move to row 2, col 1
    // 2. Set foreground to red
    // 3. Print 'b'
    // 4. Reset style
    const expected = "\x1b[2;1H\x1b[31mb\x1b[0m";
    expect(output).toBe(expected);
  });

  it("should perform a full redraw if buffer sizes change", () => {
    const prev = createMockBuffer(2, 2, "a");
    const next = createMockBuffer(3, 3, "b");

    const output = renderDiff(prev, next);

    // Avoid bottom-right cell (can cause terminal scroll); expect 8 'b's
    const occurrences = (output.match(/b/g) || []).length;
    expect(occurrences).toBe(8);

    // Check if it moves to each cell
    expect(output).toContain("\x1b[1;1H");
    expect(output).toContain("\x1b[3;2H");
  });

  it("should batch color changes", () => {
    const prev = createMockBuffer(1, 5, " ");
    const next = createMockBuffer(1, 5, " ");
    const message = "abcd ";
    for (let i = 0; i < message.length; i++) {
      setCharAt(next, i, message[i] ?? " ");
    }
    next.fg.fill("\x1b[32m", 0, 2); // green for 'a' and 'b'
    next.fg.fill("\x1b[34m", 2, 4); // blue for 'c' and 'd'

    const output = renderDiff(prev, next);

    // Expected:
    // Move -> Set Green -> 'a' -> Move -> 'b' -> Move -> Set Blue -> 'c' -> Move -> 'd' -> Reset
    const expected =
      "\x1b[1;1H\x1b[32ma" + "\x1b[1;2Hb" + "\x1b[1;3H\x1b[34mc" + "\x1b[1;4Hd" + "\x1b[0m";
    expect(output).toBe(expected);
  });

  it("should reset colors when necessary", () => {
    const prev = createMockBuffer(1, 3, " ");
    const next = createMockBuffer(1, 3, " ");
    setCharAt(next, 0, "a");
    next.fg[0] = "\x1b[31m"; // red
    setCharAt(next, 1, "b");
    // next.fg[1] is undefined

    const output = renderDiff(prev, next);

    const expected =
      "\x1b[1;1H\x1b[31ma" +
      "\x1b[1;2H\x1b[39mb" + // After red 'a', resets to default fg for 'b'
      "\x1b[0m";

    expect(output).toBe(expected);
  });

  it("should report diff stats", () => {
    const prev = createMockBuffer(2, 2, " ");
    const next = createMockBuffer(2, 2, " ");

    setCharAt(next, 0, "A");
    next.fg[0] = "\x1b[31m";
    setCharAt(next, 1, "B");
    next.fg[1] = "\x1b[31m";
    setCharAt(next, 2, "C");
    next.fg[2] = "\x1b[32m";

    const stats: DiffStats = {
      sizeChanged: false,
      fullRedraw: false,
      changedCells: 0,
      cursorMoves: 0,
      fgChanges: 0,
      bgChanges: 0,
      resets: 0,
      ops: 0,
    };

    const output = renderDiff(prev, next, stats);

    expect(output.length).toBeGreaterThan(0);
    expect(stats.changedCells).toBe(3);
    expect(stats.cursorMoves).toBe(3);
    expect(stats.fgChanges).toBe(2);
    expect(stats.ops).toBe(stats.cursorMoves + stats.fgChanges + stats.bgChanges + stats.resets);
  });
});
