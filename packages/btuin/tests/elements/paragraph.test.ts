import { describe, it, expect } from "bun:test";
import { Paragraph, isParagraph } from "../../src/elements";
import { layout } from "../../src/layout";
import { createBuffer } from "../../src/buffer";
import { renderElement } from "../../src/layout";
import { bufferToLines } from "../helpers/buffer";

describe("Paragraph component", () => {
  it("creates paragraph element with correct type", () => {
    const element = Paragraph({ text: "test" });
    expect(element.type).toBe("paragraph");
  });

  it("renders text content", () => {
    const element = Paragraph({ text: "hello world" });
    const rect = { x: 0, y: 0, width: 20, height: 1 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    expect(lines[0]).toContain("hello world");
  });

  it("pads text to fill width", () => {
    const element = Paragraph({ text: "hi" });
    const rect = { x: 0, y: 0, width: 10, height: 1 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    expect(lines[0]?.length).toBe(rect.width);
  });

  it("aligns text left by default", () => {
    const element = Paragraph({ text: "test" });
    const rect = { x: 0, y: 0, width: 10, height: 1 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    expect(lines[0]?.trim()).toBe("test");
    expect(lines[0]?.indexOf("test")).toBe(0);
  });

  it("aligns text center when specified", () => {
    const element = Paragraph({ text: "hi", align: "center" });
    const rect = { x: 0, y: 0, width: 10, height: 1 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    const textStart = lines[0]?.indexOf("hi");
    expect(textStart).toBeGreaterThan(0);
    expect(textStart).toBeLessThan(rect.width / 2);
  });

  it("aligns text right when specified", () => {
    const element = Paragraph({ text: "end", align: "right" });
    const rect = { x: 0, y: 0, width: 10, height: 1 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    expect(lines[0]?.trim()).toBe("end");
    expect(lines[0]?.indexOf("end")).toBeGreaterThan(5);
  });

  it("wraps long text by default", () => {
    const element = Paragraph({
      text: "this is a very long text that should wrap",
    });
    const rect = { x: 0, y: 0, width: 15, height: 5 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
    expect(nonEmptyLines.length).toBeGreaterThan(1);
  });

  it("disables wrapping when wrap is false", () => {
    const element = Paragraph({
      text: "this is a very long text that should not wrap",
      wrap: false,
    });
    const rect = { x: 0, y: 0, width: 15, height: 5 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
    expect(nonEmptyLines.length).toBe(1);
  });

  it("truncates text that exceeds width when not wrapping", () => {
    const element = Paragraph({
      text: "very long text here",
      wrap: false,
    });
    const rect = { x: 0, y: 0, width: 8, height: 1 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    expect(lines[0]?.length).toBe(rect.width);
  });

  it("respects color property", () => {
    const element = Paragraph({
      text: "colored",
      color: "magenta",
    });

    expect(element.color).toBe("magenta");
  });

  it("handles empty text", () => {
    const element = Paragraph({ text: "" });
    const rect = { x: 0, y: 0, width: 10, height: 1 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    expect(lines[0]?.trim()).toBe("");
  });

  it("handles multi-line text with wrapping", () => {
    const element = Paragraph({
      text: "line one line two line three",
    });
    const rect = { x: 0, y: 0, width: 10, height: 5 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
    expect(nonEmptyLines.length).toBeGreaterThanOrEqual(1);
  });

  it("handles text with multiple spaces", () => {
    const element = Paragraph({ text: "word    space" });
    const rect = { x: 0, y: 0, width: 20, height: 1 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    expect(lines[0]).toContain("word");
    expect(lines[0]).toContain("space");
  });

  it("wraps at word boundaries", () => {
    const element = Paragraph({
      text: "hello world test",
    });
    const rect = { x: 0, y: 0, width: 8, height: 3 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    // Each word should be on its own line or properly wrapped
    expect(lines.some((line) => line.includes("hello"))).toBe(true);
  });

  it("handles very long words that exceed width", () => {
    const element = Paragraph({
      text: "supercalifragilisticexpialidocious",
    });
    const rect = { x: 0, y: 0, width: 10, height: 5 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    // Should not throw error
    expect(laidOut.type).toBe("paragraph");
  });

  it("respects height limit", () => {
    const element = Paragraph({
      text: "line one line two line three line four line five line six",
    });
    const rect = { x: 0, y: 0, width: 10, height: 2 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    expect(lines.length).toBe(2);
  });

  it("supports all color values", () => {
    const colors = ["white", "gray", "magenta", "dodgerblue"] as const;

    colors.forEach((color) => {
      const element = Paragraph({ text: "test", color });
      expect(element.color).toBe(color);
    });
  });

  it("supports focusKey property", () => {
    const element = Paragraph({
      text: "focusable",
      focusKey: "para-1",
    });

    expect(element.focusKey).toBe("para-1");
  });

  it("maintains properties after layout", () => {
    const element = Paragraph({
      text: "test",
      align: "center",
      color: "magenta",
      wrap: false,
    });
    const rect = { x: 0, y: 0, width: 20, height: 5 };

    const laidOut = layout(element, rect);

    if (isParagraph(laidOut)) {
      expect(laidOut.text).toBe("test");
      expect(laidOut.align).toBe("center");
      expect(laidOut.color).toBe("magenta");
      expect(laidOut.wrap).toBe(false);
    }
  });

  it("handles explicit newline characters", () => {
    const element = Paragraph({ text: "line 1\nline 2\nline 3" });
    const rect = { x: 0, y: 0, width: 20, height: 5 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    expect(lines[0]?.trim()).toBe("line 1");
    expect(lines[1]?.trim()).toBe("line 2");
    expect(lines[2]?.trim()).toBe("line 3");
  });

  it("handles newlines with wrapping disabled", () => {
    const element = Paragraph({
      text: "first line\nsecond line",
      wrap: false,
    });
    const rect = { x: 0, y: 0, width: 15, height: 3 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    expect(lines[0]?.trim()).toBe("first line");
    expect(lines[1]?.trim()).toBe("second line");
  });

  it("combines newlines with word wrapping", () => {
    const element = Paragraph({
      text: "short\nthis is a very long line that should wrap to multiple lines",
    });
    const rect = { x: 0, y: 0, width: 15, height: 8 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    expect(lines[0]?.trim()).toBe("short");
    // The second line should be wrapped across multiple lines
    const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
    expect(nonEmptyLines.length).toBeGreaterThan(2);
  });

  it("handles multiple consecutive newlines", () => {
    const element = Paragraph({ text: "line 1\n\n\nline 2" });
    const rect = { x: 0, y: 0, width: 20, height: 6 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    expect(lines[0]?.trim()).toBe("line 1");
    // Empty lines should be preserved
    expect(lines[1]?.trim()).toBe("");
    expect(lines[2]?.trim()).toBe("");
    expect(lines[3]?.trim()).toBe("line 2");
  });

  it("handles newline at the beginning", () => {
    const element = Paragraph({ text: "\nstarting text" });
    const rect = { x: 0, y: 0, width: 20, height: 3 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    expect(lines[0]?.trim()).toBe("");
    expect(lines[1]?.trim()).toBe("starting text");
  });

  it("handles newline at the end", () => {
    const element = Paragraph({ text: "ending text\n" });
    const rect = { x: 0, y: 0, width: 20, height: 3 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    expect(lines[0]?.trim()).toBe("ending text");
    expect(lines[1]?.trim()).toBe("");
  });

  it("respects height limit with newlines", () => {
    const element = Paragraph({
      text: "line 1\nline 2\nline 3\nline 4\nline 5\nline 6",
    });
    const rect = { x: 0, y: 0, width: 20, height: 3 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    expect(lines.length).toBe(3);
    expect(lines[0]?.trim()).toBe("line 1");
    expect(lines[1]?.trim()).toBe("line 2");
    expect(lines[2]?.trim()).toBe("line 3");
  });

  it("aligns each line with newlines", () => {
    const element = Paragraph({
      text: "left\ncenter\nright",
      align: "center",
    });
    const rect = { x: 0, y: 0, width: 20, height: 5 };
    const buf = createBuffer(rect.height, rect.width);

    const laidOut = layout(element, rect);
    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    // All lines should be center-aligned
    const line1Start = lines[0]?.indexOf("left");
    const line2Start = lines[1]?.indexOf("center");
    const line3Start = lines[2]?.indexOf("right");

    expect(line1Start).toBeGreaterThan(0);
    expect(line2Start).toBeGreaterThan(0);
    expect(line3Start).toBeGreaterThan(0);
  });
});
