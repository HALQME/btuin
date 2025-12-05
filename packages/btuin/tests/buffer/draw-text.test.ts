import { describe, it, expect } from "bun:test";
import { createBuffer, drawText, setCell } from "../../src/buffer";
import { bufferToLines } from "../helpers/buffer";

describe("buffer text helpers", () => {
  it("draws text in bounds", () => {
    const buf = createBuffer(2, 6);
    drawText(buf, 0, 0, "hello");
    expect(bufferToLines(buf)[0]).toBe("hello ");
  });

  it("ignores out-of-range writes", () => {
    const buf = createBuffer(1, 4);
    drawText(buf, 2, 0, "test");
    expect(bufferToLines(buf)).toEqual(["    "]);
  });

  it("allows overriding colors via setCell", () => {
    const buf = createBuffer(1, 1);
    setCell(buf, 0, 0, { ch: "x", fg: "magenta" });
    expect(bufferToLines(buf)[0]).toBe("x");
  });
});
