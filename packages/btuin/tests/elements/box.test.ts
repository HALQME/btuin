import { describe, it, expect } from "bun:test";
import { Box, Paragraph, isBox, isParagraph } from "../../src/elements";
import { layout } from "../../src/layout";
import { createBuffer } from "../../src/buffer";
import { renderElement } from "../../src/layout";
import { bufferToLines } from "../helpers/buffer";

describe("Box component", () => {
  it("creates box element with correct type", () => {
    const element = Box({ child: Paragraph({ text: "test" }) });
    expect(element.type).toBe("box");
  });

  it("accepts child element", () => {
    const child = Paragraph({ text: "child content" });
    const element = Box({ child });
    expect(element.child).toBe(child);
  });

  it("accepts optional child", () => {
    const element = Box({});
    expect(element.child).toBeUndefined();
  });

  it("layouts child within box rect", () => {
    const child = Paragraph({ text: "hello" });
    const element = Box({ child });
    const rect = { x: 0, y: 0, width: 10, height: 5 };

    const laidOut = layout(element, rect);

    expect(laidOut.rect).toEqual(rect);
    expect(laidOut.type).toBe("box");
  });

  it("passes innerRect to child when outline is present", () => {
    const child = Paragraph({ text: "content" });
    const element = Box({
      child,
      outline: { style: "single" },
    });
    const rect = { x: 0, y: 0, width: 20, height: 10 };

    const laidOut = layout(element, rect);

    expect(laidOut.rect).toEqual(rect);
    if (isBox(laidOut) && laidOut.child) {
      expect(laidOut.child.rect).toBeDefined();
    }
  });

  it("renders child content", () => {
    const child = Paragraph({ text: "test" });
    const element = Box({ child });
    const rect = { x: 0, y: 0, width: 10, height: 3 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    expect(lines[0]).toContain("test");
  });

  it("renders empty box when no child", () => {
    const element = Box({});
    const rect = { x: 0, y: 0, width: 10, height: 3 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    // Should not throw error
    expect(laidOut.type).toBe("box");
  });

  it("respects width and height properties", () => {
    const child = Paragraph({ text: "content" });
    const element = Box({
      child,
      width: 15,
      height: 8,
    });
    const rect = { x: 0, y: 0, width: 20, height: 10 };

    const laidOut = layout(element, rect) as any;

    expect(laidOut.rect?.width).toBeLessThanOrEqual(rect.width);
    expect(laidOut.rect?.height).toBeLessThanOrEqual(rect.height);
  });

  it("supports focusKey property", () => {
    const child = Paragraph({ text: "focusable" });
    const element = Box({
      child,
      focusKey: "my-box",
    });

    expect(element.focusKey).toBe("my-box");
  });

  it("handles nested boxes", () => {
    const innerChild = Paragraph({ text: "inner" });
    const innerBox = Box({ child: innerChild });
    const outerBox = Box({ child: innerBox });
    const rect = { x: 0, y: 0, width: 20, height: 10 };

    const laidOut = layout(outerBox, rect);

    expect(laidOut.type).toBe("box");
    if (isBox(laidOut) && laidOut.child && isBox(laidOut.child)) {
      expect(laidOut.child.type).toBe("box");
    }
  });

  it("maintains child properties after layout", () => {
    const child = Paragraph({ text: "Hello", color: "magenta", align: "center" });
    const element = Box({ child });
    const rect = { x: 0, y: 0, width: 20, height: 5 };

    const laidOut = layout(element, rect);

    if (isBox(laidOut) && laidOut.child && isParagraph(laidOut.child)) {
      expect(laidOut.child.text).toBe("Hello");
      expect(laidOut.child.color).toBe("magenta");
      expect(laidOut.child.align).toBe("center");
    }
  });

  it("supports outline options", () => {
    const child = Paragraph({ text: "boxed" });
    const element = Box({
      child,
      outline: {
        style: "single",
        title: "Test Box",
      },
    });

    expect(element.outline).toBeDefined();
    expect(element.outline?.title).toBe("Test Box");
  });
});
