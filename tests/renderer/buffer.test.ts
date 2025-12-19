import { describe, it, expect } from "bun:test";
import { FlatBuffer } from "@/renderer/buffer";

describe("FlatBuffer", () => {
  const rows = 5;
  const cols = 10;
  const size = rows * cols;

  it("should construct with correct dimensions and initial state", () => {
    const buffer = new FlatBuffer(rows, cols);
    expect(buffer.rows).toBe(rows);
    expect(buffer.cols).toBe(cols);
    expect(buffer.codes.length).toBe(size);
    expect(buffer.widths.length).toBe(size);
    expect(buffer.fg.length).toBe(size);
    expect(buffer.bg.length).toBe(size);

    // Check that it's cleared initially
    for (let i = 0; i < size; i++) {
      expect(buffer.glyphStringAtIndex(i)).toBe(" ");
      expect(buffer.widths[i]).toBe(1);
      expect(buffer.fg[i]).toBeUndefined();
      expect(buffer.bg[i]).toBeUndefined();
    }
  });

  it("should calculate the correct index", () => {
    const buffer = new FlatBuffer(rows, cols);
    expect(buffer.index(0, 0)).toBe(0);
    expect(buffer.index(0, 9)).toBe(9);
    expect(buffer.index(1, 0)).toBe(10);
    expect(buffer.index(4, 9)).toBe(49);
  });

  it("should clear the buffer", () => {
    const buffer = new FlatBuffer(rows, cols);
    const idx = buffer.index(2, 2);
    buffer.set(2, 2, "X");
    buffer.fg[idx] = "red";
    buffer.bg[idx] = "blue";

    buffer.clear();

    expect(buffer.glyphStringAtIndex(idx)).toBe(" ");
    expect(buffer.widths[idx]).toBe(1);
    expect(buffer.fg[idx]).toBeUndefined();
    expect(buffer.bg[idx]).toBeUndefined();
  });
});
