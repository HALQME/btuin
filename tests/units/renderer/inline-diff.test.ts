import { describe, it, expect } from "bun:test";
import { FlatBuffer, resolveColor, createInlineDiffRenderer } from "@/renderer";

describe("createInlineDiffRenderer", () => {
  it("renders full frames using line clears and relative cursor movement", () => {
    const inline = createInlineDiffRenderer();

    const prev = new FlatBuffer(2, 3);
    const next1 = new FlatBuffer(2, 3);
    next1.set(0, 0, "A", { fg: resolveColor("red", "fg") });
    next1.set(1, 2, "B");

    const out1 = inline.renderDiff(prev, next1);
    expect(out1).toContain("\x1b[2K\r");
    expect(out1).toContain("A");
    expect(out1).toContain("B");

    const next2 = new FlatBuffer(2, 3);
    next2.set(0, 0, "Z");

    const out2 = inline.renderDiff(next1, next2);
    expect(out2).toContain("\x1b[1A\r");
    expect(out2).toContain("\x1b[2K\rZ");

    const out3 = inline.cleanup();
    expect(out3).toContain("\x1b[2K\r");
  });

  it("does not print trailing empty terminal rows", () => {
    const inline = createInlineDiffRenderer();

    const prev = new FlatBuffer(5, 3);
    const next = new FlatBuffer(5, 3);
    next.set(0, 0, "X");

    const out = inline.renderDiff(prev, next);
    // Only one cleared line is needed for a single used row.
    expect(out.match(/\x1b\[2K\r/g)?.length).toBe(1);
  });
});
