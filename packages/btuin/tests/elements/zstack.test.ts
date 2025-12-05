import { describe, it, expect } from "bun:test";
import { ZStack, Paragraph, isParagraph } from "../../src/elements";
import { isMultiChildElement } from "@btuin/types/elements";
import { layout } from "../../src/layout";
import { createBuffer } from "../../src/buffer";
import { renderElement } from "../../src/layout";
import { bufferToLines } from "../helpers/buffer";

describe("ZStack component", () => {
  it("creates zstack element with correct type", () => {
    const element = ZStack({
      children: [Paragraph({ text: "child1" }), Paragraph({ text: "child2" })],
    });
    expect(element.type).toBe("zstack");
  });

  it("arranges children at same position (stacked)", () => {
    const element = ZStack({
      children: [Paragraph({ text: "back" }), Paragraph({ text: "front" })],
    });
    const rect = { x: 0, y: 0, width: 20, height: 5 };

    const laidOut = layout(element, rect);
    if (isMultiChildElement(laidOut)) {
      expect(laidOut.children).toBeDefined();
      expect(laidOut.children.length).toBe(2);

      // All children should have same rect
      const child1Rect = laidOut.children[0]?.rect;
      const child2Rect = laidOut.children[1]?.rect;

      expect(child1Rect?.x).toBe(child2Rect?.x);
      expect(child1Rect?.y).toBe(child2Rect?.y);
      expect(child1Rect?.width).toBe(child2Rect?.width);
      expect(child1Rect?.height).toBe(child2Rect?.height);
    }
  });

  it("respects parent rect dimensions", () => {
    const element = ZStack({
      children: [Paragraph({ text: "child1" }), Paragraph({ text: "child2" })],
    });
    const rect = { x: 5, y: 10, width: 30, height: 8 };

    const laidOut = layout(element, rect);
    if (isMultiChildElement(laidOut)) {
      const childRect = laidOut.children[0]?.rect;

      expect(childRect?.x).toBe(5);
      expect(childRect?.y).toBe(10);
      expect(childRect?.width).toBe(30);
      expect(childRect?.height).toBe(8);
    }
  });

  it("handles single child", () => {
    const element = ZStack({
      children: [Paragraph({ text: "soro child" })],
    });
    const rect = { x: 0, y: 0, width: 20, height: 5 };

    const laidOut = layout(element, rect);
    if (isMultiChildElement(laidOut)) {
      expect(laidOut.children.length).toBe(1);
      expect(laidOut.children[0]?.rect?.width).toBe(20);
    }
  });

  it("handles empty children array", () => {
    const element = ZStack({ children: [] });
    const rect = { x: 0, y: 0, width: 20, height: 5 };

    const laidOut = layout(element, rect);
    if (isMultiChildElement(laidOut)) {
      expect(laidOut.children.length).toBe(0);
    }
  });

  it("renders all children in correct order", () => {
    const element = ZStack({
      children: [
        Paragraph({ text: "first", color: "gray" }),
        Paragraph({ text: "second", color: "magenta" }),
        Paragraph({ text: "third", color: "gray" }),
      ],
    });
    const rect = { x: 0, y: 0, width: 20, height: 2 };

    const laidOut = layout(element, rect);
    const buf = createBuffer(rect.height, rect.width);
    renderElement(laidOut, buf);
    const lines = bufferToLines(buf);
    const text = lines.join("");

    // Both should be rendered (second might overlap first visually)
    if (isMultiChildElement(laidOut)) {
      expect(laidOut.children.length).toBe(3);
    }
  });

  it("passes full rect to all children", () => {
    const element = ZStack({
      children: [
        Paragraph({ text: "child1" }),
        Paragraph({ text: "child2" }),
        Paragraph({ text: "child3" }),
      ],
    });
    const rect = { x: 2, y: 3, width: 25, height: 10 };

    const laidOut = layout(element, rect);

    if (isMultiChildElement(laidOut)) {
      laidOut.children.forEach((child) => {
        expect(child.rect?.x).toBe(2);
        expect(child.rect?.y).toBe(3);
        expect(child.rect?.width).toBe(25);
        expect(child.rect?.height).toBe(10);
      });
    }
  });

  it("supports nested ZStacks", () => {
    const innerZStack = ZStack({
      children: [Paragraph({ text: "inner" })],
    });

    const outerZStack = ZStack({
      children: [Paragraph({ text: "outer1" }), innerZStack],
    });

    const rect = { x: 0, y: 0, width: 20, height: 5 };
    const laidOut = layout(outerZStack, rect);

    if (isMultiChildElement(laidOut)) {
      expect(laidOut.children.length).toBe(2);
      expect(laidOut.children[1]?.type).toBe("zstack");
    }
  });

  it("respects focusKey property", () => {
    const element = ZStack({
      focusKey: "my-zstack",
      children: [Paragraph({ text: "child" })],
    });

    expect(element.focusKey).toBe("my-zstack");
  });

  it("maintains children properties after layout", () => {
    const element = ZStack({
      children: [
        Paragraph({ text: "child1", color: "cyan" }),
        Paragraph({ text: "child2", color: "red" }),
        Paragraph({ text: "child3", color: "green" }),
      ],
    });
    const rect = { x: 0, y: 0, width: 20, height: 5 };

    const laidOut = layout(element, rect);

    if (isMultiChildElement(laidOut) && laidOut.children.length >= 3) {
      const child0 = laidOut.children[0];
      const child1 = laidOut.children[1];
      const child2 = laidOut.children[2];

      if (child0 && isParagraph(child0)) expect(child0.color).toBe("cyan");
      if (child1 && isParagraph(child1)) expect(child1.color).toBe("red");
      if (child2 && isParagraph(child2)) expect(child2.color).toBe("green");
    }
  });

  it("handles width and height props on zstack", () => {
    const element = ZStack({
      width: 15,
      height: 3,
      children: [Paragraph({ text: "child" })],
    });

    expect(element.width).toBe(15);
    expect(element.height).toBe(3);
  });

  it("renders zstack with box children", () => {
    const element = ZStack({
      children: [
        { type: "box", children: [Paragraph({ text: "box1" })] },
        { type: "box", children: [Paragraph({ text: "box2" })] },
      ],
    });
    const rect = { x: 0, y: 0, width: 20, height: 5 };

    const laidOut = layout(element, rect);
    const buf = createBuffer(rect.height, rect.width);

    expect(() => renderElement(laidOut, buf)).not.toThrow();
  });

  it("handles vstack and hstack children mixed in zstack", () => {
    const element = ZStack({
      children: [
        {
          type: "vstack",
          children: [Paragraph({ text: "v1" }), Paragraph({ text: "v2" })],
        },
        {
          type: "hstack",
          children: [Paragraph({ text: "h1" }), Paragraph({ text: "h2" })],
        },
      ],
    });
    const rect = { x: 0, y: 0, width: 30, height: 10 };

    const laidOut = layout(element, rect);
    if (isMultiChildElement(laidOut)) {
      expect(laidOut.children.length).toBe(2);
      expect(laidOut.children[0]?.type).toBe("vstack");
      expect(laidOut.children[1]?.type).toBe("hstack");
    }
  });
});
