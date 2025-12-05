import { describe, it, expect } from "bun:test";
import { layout } from "../../src/layout";
import { VStack, Paragraph, Box } from "../../src/elements";

describe("layout tree", () => {
  it("arranges VStack children vertically", () => {
    const element = VStack({
      gap: 1,
      children: [Paragraph({ text: "one" }), Paragraph({ text: "two" })],
    });
    const rect = { x: 0, y: 0, width: 10, height: 5 };
    const laidOut = layout(element, rect);
    expect(laidOut.rect).toEqual(rect);
    expect(laidOut.type).toBe("vstack");
  });

  it("passes inner rect to box child", () => {
    const child = Paragraph({ text: "hello" });
    const box = Box({ child, outline: { title: "test" } });
    const rect = { x: 0, y: 0, width: 20, height: 3 };
    const laidOut = layout(box, rect);
    expect(laidOut.type).toBe("box");
  });
});
