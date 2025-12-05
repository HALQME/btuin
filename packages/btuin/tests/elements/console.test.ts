import { describe, it, expect, beforeEach } from "bun:test";
import { Console, isConsole, isParagraph } from "../../src/elements";
import { isMultiChildElement } from "@btuin/types/elements";
import { layout } from "../../src/layout";
import { createBuffer } from "../../src/buffer";
import { renderElement } from "../../src/layout";
import { bufferToLines } from "../helpers/buffer";

describe("Console component", () => {
  it("creates console element with correct type", () => {
    const element = Console({ maxLines: 10 });
    expect(element.type).toBe("console");
  });

  it("returns element with proper props", () => {
    const element = Console({
      maxLines: 15,
      title: "Output",
      showStdout: true,
      showStderr: true,
    });
    expect(element.maxLines).toBe(15);
    expect(element.title).toBe("Output");
    expect(element.showStdout).toBe(true);
    expect(element.showStderr).toBe(true);
  });

  it("lays out with children array", () => {
    const element = Console({ maxLines: 10 });
    const rect = { x: 0, y: 0, width: 40, height: 10 };

    const laidOut = layout(element, rect);
    expect(laidOut.type).toBe("console");
    if (isMultiChildElement(laidOut)) {
      expect(laidOut.children).toBeDefined();
      expect(Array.isArray(laidOut.children)).toBe(true);
    }
  });

  it("shows placeholder when no lines to display", () => {
    const element = Console({ maxLines: 10 });
    const rect = { x: 0, y: 0, width: 40, height: 10 };

    const laidOut = layout(element, rect);
    const buf = createBuffer(rect.height, rect.width);
    renderElement(laidOut, buf);
    const lines = bufferToLines(buf);
    const text = lines.join("");

    expect(text).toContain("no console output");
  });

  it("respects maxLines limit in layout", () => {
    const element = Console({ maxLines: 5 });
    const rect = { x: 0, y: 0, width: 40, height: 10 };

    const laidOut = layout(element, rect);
    if (isMultiChildElement(laidOut)) {
      const contentLines = laidOut.children.filter((child) => child.type === "paragraph");
      expect(contentLines.length).toBeLessThanOrEqual(5);
    }
  });

  it("includes title in children when provided", () => {
    const element = Console({ maxLines: 10, title: "My Console" });
    const rect = { x: 0, y: 0, width: 40, height: 10 };

    const laidOut = layout(element, rect);
    if (isMultiChildElement(laidOut)) {
      const titleChild = laidOut.children.find(
        (child) => isParagraph(child) && child.text === "My Console",
      );
      expect(titleChild).toBeDefined();
    }
  });

  it("renders to buffer without errors", () => {
    const element = Console({ maxLines: 10 });
    const rect = { x: 0, y: 0, width: 40, height: 5 };

    const laidOut = layout(element, rect);
    const buf = createBuffer(rect.height, rect.width);

    expect(() => renderElement(laidOut, buf)).not.toThrow();
  });

  it("respects width property", () => {
    const element = Console({ maxLines: 10, width: 20 });

    expect(element.width).toBe(20);
  });

  it("respects height property", () => {
    const element = Console({ maxLines: 10, height: 5 });

    expect(element.height).toBe(5);
  });

  it("respects focusKey property", () => {
    const element = Console({ maxLines: 10, focusKey: "my-console" });

    expect(element.focusKey).toBe("my-console");
  });

  it("handles showStdout property", () => {
    const element1 = Console({ maxLines: 10, showStdout: true });
    const element2 = Console({ maxLines: 10, showStdout: false });

    expect(element1.showStdout).toBe(true);
    expect(element2.showStdout).toBe(false);
  });

  it("handles showStderr property", () => {
    const element1 = Console({ maxLines: 10, showStderr: true });
    const element2 = Console({ maxLines: 10, showStderr: false });

    expect(element1.showStderr).toBe(true);
    expect(element2.showStderr).toBe(false);
  });

  it("lays out children with correct rects", () => {
    const element = Console({ maxLines: 10, title: "Test" });
    const rect = { x: 5, y: 10, width: 30, height: 8 };

    const laidOut = layout(element, rect);

    if (isMultiChildElement(laidOut)) {
      laidOut.children.forEach((child) => {
        expect(child.rect?.x).toBeGreaterThanOrEqual(rect.x);
        expect(child.rect?.y).toBeGreaterThanOrEqual(rect.y);
      });
    }
  });

  it("maintains element type through layout", () => {
    const element = Console({ maxLines: 10 });
    const rect = { x: 0, y: 0, width: 40, height: 10 };

    const laidOut = layout(element, rect);

    expect(laidOut.type).toBe("console");
  });
});
