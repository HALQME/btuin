import { describe, it, expect } from "bun:test";
import { FlatBuffer } from "@/renderer/buffer";

describe("FlatBuffer scroll helpers", () => {
  it("scrollRowsFrom should scroll a band up and clear exposed rows", () => {
    const prev = new FlatBuffer(5, 5);
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        prev.set(r, c, String(r), { fg: `c${r}` });
      }
    }
    prev.set(2, 0, "a\u0304"); // multi-code-point glyph stored in extras

    const next = new FlatBuffer(5, 5);
    next.copyFrom(prev);
    next.scrollRowsFrom(prev, 1, 3, -1);

    // unaffected rows
    expect(next.get(0, 0).char).toBe("0");
    expect(next.get(4, 0).char).toBe("4");

    // band moved up: row1 <- row2, row2 <- row3, row3 cleared
    expect(next.get(1, 0).char).toBe("a\u0304");
    expect(next.get(2, 0).char).toBe("3");
    expect(next.get(3, 0).char).toBe(" ");
    expect(next.get(3, 0).style.fg).toBeUndefined();
  });

  it("scrollRowsFrom should scroll a band down and clear exposed rows", () => {
    const prev = new FlatBuffer(5, 5);
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        prev.set(r, c, String(r), { bg: `b${r}` });
      }
    }

    const next = new FlatBuffer(5, 5);
    next.copyFrom(prev);
    next.scrollRowsFrom(prev, 1, 3, 1);

    expect(next.get(0, 0).char).toBe("0");
    expect(next.get(4, 0).char).toBe("4");

    // band moved down: row3 <- row2, row2 <- row1, row1 cleared
    expect(next.get(3, 0).char).toBe("2");
    expect(next.get(2, 0).char).toBe("1");
    expect(next.get(1, 0).char).toBe(" ");
    expect(next.get(1, 0).style.bg).toBeUndefined();
  });
});
