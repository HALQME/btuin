import { describe, expect, test } from "bun:test";
import { createBuffer, drawText, fillRect } from "@/renderer/grid";

describe("@btuin/renderer grid", () => {
  test("fillRect floors non-integer coordinates", () => {
    const buf = createBuffer(3, 3);
    fillRect(buf, 0.9, 0.9, 2.9, 1.9, "X");

    expect(buf.get(0, 0).char).toBe("X");
    expect(buf.get(0, 1).char).toBe("X");
    expect(buf.get(0, 2).char).toBe(" ");
  });

  test("drawText floors non-integer coordinates", () => {
    const buf = createBuffer(2, 4);
    drawText(buf, 0.2, 1.8, "A");
    expect(buf.get(0, 1).char).toBe("A");
  });
});
