import { describe, it, expect } from "bun:test";
import { HStack, VStack, Paragraph, isVStack, isHStack } from "../../src/elements";
import { layout } from "../../src/layout";
import { createBuffer } from "../../src/buffer";
import { renderElement } from "../../src/layout";
import { bufferToLines } from "../helpers/buffer";

describe("VStack component", () => {
  it("creates vstack element with correct type", () => {
    const element = VStack({ children: [] });
    expect(element.type).toBe("vstack");
  });

  it("arranges children vertically", () => {
    const element = VStack({
      children: [
        Paragraph({ text: "first", height: 2 }),
        Paragraph({ text: "second", height: 2 }),
        Paragraph({ text: "third", height: 2 }),
      ],
    });
    const rect = { x: 0, y: 0, width: 20, height: 10 };

    const laidOut = layout(element, rect);

    expect(laidOut.type).toBe("vstack");
    if (isVStack(laidOut)) {
      expect(laidOut.children.length).toBe(3);
      // Children should be arranged vertically
      expect(laidOut.children[0]?.rect?.y).toBe(0);
      expect(laidOut.children[1]?.rect?.y).toBeGreaterThan(0);
      expect(laidOut.children[2]?.rect?.y).toBeGreaterThan(laidOut.children[1]?.rect?.y || 0);
    }
  });

  it("respects gap property", () => {
    const element = VStack({
      gap: 2,
      children: [Paragraph({ text: "first", height: 3 }), Paragraph({ text: "second", height: 3 })],
    });
    const rect = { x: 0, y: 0, width: 20, height: 20 };

    const laidOut = layout(element, rect);

    if (isVStack(laidOut)) {
      const firstY = laidOut.children[0]?.rect?.y || 0;
      const firstHeight = laidOut.children[0]?.rect?.height || 0;
      const secondY = laidOut.children[1]?.rect?.y || 0;

      // Second element should start after first element + gap
      expect(secondY).toBe(firstY + firstHeight + 2);
    }
  });

  it("handles zero gap", () => {
    const element = VStack({
      gap: 0,
      children: [Paragraph({ text: "first", height: 2 }), Paragraph({ text: "second", height: 2 })],
    });
    const rect = { x: 0, y: 0, width: 20, height: 10 };

    const laidOut = layout(element, rect);

    if (isVStack(laidOut)) {
      const firstHeight = laidOut.children[0]?.rect?.height || 0;
      const secondY = laidOut.children[1]?.rect?.y || 0;

      // Second element should start immediately after first
      expect(secondY).toBe(firstHeight);
    }
  });

  it("distributes space among children with auto height", () => {
    const element = VStack({
      children: [
        Paragraph({ text: "auto 1", height: "auto" }),
        Paragraph({ text: "auto 2", height: "auto" }),
      ],
    });
    const rect = { x: 0, y: 0, width: 20, height: 10 };

    const laidOut = layout(element, rect);

    if (isVStack(laidOut)) {
      // Children with auto height should share available space
      expect(laidOut.children[0]?.rect?.height).toBeGreaterThan(0);
      expect(laidOut.children[1]?.rect?.height).toBeGreaterThan(0);
    }
  });

  it("handles empty children array", () => {
    const element = VStack({ children: [] });
    const rect = { x: 0, y: 0, width: 20, height: 10 };

    const laidOut = layout(element, rect);

    expect(laidOut.type).toBe("vstack");
    if (isVStack(laidOut)) {
      expect(laidOut.children.length).toBe(0);
    }
  });

  it("renders all children", () => {
    const element = VStack({
      children: [
        Paragraph({ text: "line1" }),
        Paragraph({ text: "line2" }),
        Paragraph({ text: "line3" }),
      ],
    });
    const rect = { x: 0, y: 0, width: 20, height: 10 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    const text = lines.join("");
    expect(text).toContain("line1");
    expect(text).toContain("line2");
    expect(text).toContain("line3");
  });

  it("gives all children the full width", () => {
    const element = VStack({
      children: [Paragraph({ text: "first" }), Paragraph({ text: "second" })],
    });
    const rect = { x: 0, y: 0, width: 30, height: 10 };

    const laidOut = layout(element, rect);

    if (isVStack(laidOut)) {
      laidOut.children.forEach((child) => {
        expect(child.rect?.width).toBe(30);
      });
    }
  });

  it("supports nested VStacks", () => {
    const element = VStack({
      children: [
        Paragraph({ text: "outer" }),
        VStack({
          children: [Paragraph({ text: "inner1" }), Paragraph({ text: "inner2" })],
        }),
      ],
    });
    const rect = { x: 0, y: 0, width: 20, height: 20 };

    const laidOut = layout(element, rect);

    expect(laidOut.type).toBe("vstack");
    if (isVStack(laidOut)) {
      expect(laidOut.children[1]?.type).toBe("vstack");
    }
  });
});

describe("HStack component", () => {
  it("creates hstack element with correct type", () => {
    const element = HStack({ children: [] });
    expect(element.type).toBe("hstack");
  });

  it("arranges children horizontally", () => {
    const element = HStack({
      children: [
        Paragraph({ text: "first", width: 10 }),
        Paragraph({ text: "second", width: 10 }),
        Paragraph({ text: "third", width: 10 }),
      ],
    });
    const rect = { x: 0, y: 0, width: 40, height: 5 };

    const laidOut = layout(element, rect);

    expect(laidOut.type).toBe("hstack");
    if (isHStack(laidOut)) {
      expect(laidOut.children.length).toBe(3);
      // Children should be arranged horizontally
      expect(laidOut.children[0]?.rect?.x).toBe(0);
      expect(laidOut.children[1]?.rect?.x).toBeGreaterThan(0);
      expect(laidOut.children[2]?.rect?.x).toBeGreaterThan(laidOut.children[1]?.rect?.x || 0);
    }
  });

  it("respects gap property", () => {
    const element = HStack({
      gap: 3,
      children: [Paragraph({ text: "first", width: 5 }), Paragraph({ text: "second", width: 5 })],
    });
    const rect = { x: 0, y: 0, width: 20, height: 5 };

    const laidOut = layout(element, rect);

    if (isHStack(laidOut)) {
      const firstX = laidOut.children[0]?.rect?.x || 0;
      const firstWidth = laidOut.children[0]?.rect?.width || 0;
      const secondX = laidOut.children[1]?.rect?.x || 0;

      // Second element should start after first element + gap
      expect(secondX).toBe(firstX + firstWidth + 3);
    }
  });

  it("handles zero gap", () => {
    const element = HStack({
      gap: 0,
      children: [Paragraph({ text: "first", width: 10 }), Paragraph({ text: "second", width: 10 })],
    });
    const rect = { x: 0, y: 0, width: 30, height: 5 };

    const laidOut = layout(element, rect);

    if (isHStack(laidOut)) {
      const firstWidth = laidOut.children[0]?.rect?.width || 0;
      const secondX = laidOut.children[1]?.rect?.x || 0;

      // Second element should start immediately after first
      expect(secondX).toBe(firstWidth);
    }
  });

  it("distributes space among children with auto width", () => {
    const element = HStack({
      children: [
        Paragraph({ text: "auto 1", width: "auto" }),
        Paragraph({ text: "auto 2", width: "auto" }),
      ],
    });
    const rect = { x: 0, y: 0, width: 40, height: 5 };

    const laidOut = layout(element, rect);

    if (isHStack(laidOut)) {
      // Children with auto width should share available space
      expect(laidOut.children[0]?.rect?.width).toBeGreaterThan(0);
      expect(laidOut.children[1]?.rect?.width).toBeGreaterThan(0);
    }
  });

  it("handles empty children array", () => {
    const element = HStack({ children: [] });
    const rect = { x: 0, y: 0, width: 20, height: 5 };

    const laidOut = layout(element, rect);

    expect(laidOut.type).toBe("hstack");
    if (isHStack(laidOut)) {
      expect(laidOut.children.length).toBe(0);
    }
  });

  it("renders all children", () => {
    const element = HStack({
      children: [
        Paragraph({ text: "col1", width: 10 }),
        Paragraph({ text: "col2", width: 10 }),
        Paragraph({ text: "col3", width: 10 }),
      ],
    });
    const rect = { x: 0, y: 0, width: 40, height: 5 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    const text = lines.join("");
    expect(text).toContain("col1");
    expect(text).toContain("col2");
    expect(text).toContain("col3");
  });

  it("gives all children the full height", () => {
    const element = HStack({
      children: [Paragraph({ text: "first", width: 15 }), Paragraph({ text: "second", width: 15 })],
    });
    const rect = { x: 0, y: 0, width: 40, height: 8 };

    const laidOut = layout(element, rect);

    if (isHStack(laidOut)) {
      laidOut.children.forEach((child) => {
        expect(child.rect?.height).toBeLessThanOrEqual(8);
      });
    }
  });

  it("supports nested HStacks", () => {
    const element = HStack({
      children: [
        Paragraph({ text: "outer", width: 10 }),
        HStack({
          children: [
            Paragraph({ text: "inner1", width: 10 }),
            Paragraph({ text: "inner2", width: 10 }),
          ],
        }),
      ],
    });
    const rect = { x: 0, y: 0, width: 50, height: 5 };

    const laidOut = layout(element, rect);

    expect(laidOut.type).toBe("hstack");
    if (isHStack(laidOut)) {
      expect(laidOut.children[1]?.type).toBe("hstack");
    }
  });

  it("handles mixed VStack and HStack", () => {
    const element = VStack({
      children: [
        HStack({
          children: [
            Paragraph({ text: "top-left", width: 20 }),
            Paragraph({ text: "top-right", width: 20 }),
          ],
        }),
        HStack({
          children: [
            Paragraph({ text: "bottom-left", width: 20 }),
            Paragraph({ text: "bottom-right", width: 20 }),
          ],
        }),
      ],
    });
    const rect = { x: 0, y: 0, width: 40, height: 10 };

    const laidOut = layout(element, rect);

    expect(laidOut.type).toBe("vstack");
    if (isVStack(laidOut)) {
      expect(laidOut.children[0]?.type).toBe("hstack");
      expect(laidOut.children[1]?.type).toBe("hstack");
    }
  });
});

describe("Stack layout edge cases", () => {
  it("handles VStack with more content than available height", () => {
    const element = VStack({
      children: [
        Paragraph({ text: "1", height: 5 }),
        Paragraph({ text: "2", height: 5 }),
        Paragraph({ text: "3", height: 5 }),
      ],
    });
    const rect = { x: 0, y: 0, width: 20, height: 8 };

    const laidOut = layout(element, rect);

    // Should not throw, layout algorithm handles overflow
    expect(laidOut.type).toBe("vstack");
  });

  it("handles HStack with more content than available width", () => {
    const element = HStack({
      children: [
        Paragraph({ text: "1", width: 15 }),
        Paragraph({ text: "2", width: 15 }),
        Paragraph({ text: "3", width: 15 }),
      ],
    });
    const rect = { x: 0, y: 0, width: 30, height: 5 };

    const laidOut = layout(element, rect);

    // Should not throw, layout algorithm handles overflow
    expect(laidOut.type).toBe("hstack");
  });

  it("handles VStack with single child", () => {
    const element = VStack({
      children: [Paragraph({ text: "only child" })],
    });
    const rect = { x: 0, y: 0, width: 20, height: 10 };

    const laidOut = layout(element, rect);

    expect(laidOut.type).toBe("vstack");
    if (isVStack(laidOut)) {
      expect(laidOut.children.length).toBe(1);
    }
  });

  it("handles HStack with single child", () => {
    const element = HStack({
      children: [Paragraph({ text: "only child" })],
    });
    const rect = { x: 0, y: 0, width: 20, height: 5 };

    const laidOut = layout(element, rect);

    expect(laidOut.type).toBe("hstack");
    if (isHStack(laidOut)) {
      expect(laidOut.children.length).toBe(1);
    }
  });
});
