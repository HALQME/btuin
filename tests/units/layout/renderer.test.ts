import { describe, expect, test, beforeAll } from "bun:test";
import { renderElement } from "@/layout/renderer";
import { layout } from "@/layout";
import { Block, Text } from "@/view/primitives";
import { createBuffer, resolveColor, type Buffer2D } from "@/renderer";

// Helper to visualize the buffer
function bufferToString(buf: Buffer2D): string {
  let out = "";
  for (let r = 0; r < buf.rows; r++) {
    for (let c = 0; c < buf.cols; c++) {
      const char = buf.get(r, c).char || " ";
      out += char;
    }
    out += "\n";
  }
  return out;
}

describe("renderElement", () => {
  beforeAll(async () => {});

  test("should render a simple text element", () => {
    const root = Text({ value: "Hello" }).setKey("root").build();
    const layoutMap = layout(root, { width: 10, height: 1 });
    const buffer = createBuffer(1, 10);

    renderElement(root, buffer, layoutMap);

    expect(bufferToString(buffer).trim()).toBe("Hello");
  });

  test("should render a block with a background color", () => {
    const root = Block().background("blue").setKey("root").build();
    const layoutMap = layout(root, { width: 5, height: 2 });
    const buffer = createBuffer(2, 5);

    renderElement(root, buffer, layoutMap);

    // Check if the background was applied
    for (let i = 0; i < buffer.codes.length; i++) {
      expect(buffer.bg[i]).toBe(resolveColor("blue", "bg"));
    }
  });

  test("should draw a single-style outline", () => {
    const root = Block().outline({ style: "single" }).setKey("root").build();
    const layoutMap = layout(root, { width: 3, height: 3 });
    const buffer = createBuffer(3, 3);

    renderElement(root, buffer, layoutMap);

    const expected = "┌─┐\n" + "│ │\n" + "└─┘\n";

    expect(bufferToString(buffer)).toBe(expected);
  });

  test("should draw a double-style outline with a color", () => {
    const root = Block().outline({ style: "double", color: "red" }).setKey("root").build();
    const layoutMap = layout(root, { width: 3, height: 3 });
    const buffer = createBuffer(3, 3);

    renderElement(root, buffer, layoutMap);

    const expected = "╔═╗\n" + "║ ║\n" + "╚═╝\n";

    expect(bufferToString(buffer)).toBe(expected);
    // Check a corner and a side for the color
    expect(buffer.get(0, 0).style.fg).toBe(resolveColor("red", "fg"));
    expect(buffer.get(0, 1).style.fg).toBe(resolveColor("red", "fg"));
  });

  test("should render nested children with parent offsets", () => {
    const child = Text({ value: "Hi" }).setKey("child").build();
    const parent = Block(child).setKey("parent").build();
    const root = Block(parent).setKey("root").build();

    const layoutMap = {
      root: { x: 0, y: 0, width: 10, height: 5 },
      parent: { x: 2, y: 1, width: 5, height: 3 },
      child: { x: 1, y: 1, width: 2, height: 1 },
    };
    const buffer = createBuffer(5, 10);

    renderElement(root, buffer, layoutMap);

    // The child's absolute position should be parent's + child's
    // absX = 2 + 1 = 3
    // absY = 1 + 1 = 2
    expect(buffer.get(2, 3).char).toBe("H");
    expect(buffer.get(2, 4).char).toBe("i");
  });

  test("should apply parentX and parentY offsets", () => {
    const root = Text({ value: "Offset" }).setKey("root").build();
    const layoutMap = {
      root: { x: 1, y: 1, width: 6, height: 1 },
    };
    const buffer = createBuffer(3, 10);
    const parentX = 2;
    const parentY = 1;

    renderElement(root, buffer, layoutMap, parentX, parentY);

    // The text absolute position should be parent offset + layout offset
    // absX = 2 + 1 = 3
    // absY = 1 + 1 = 2
    expect(buffer.get(2, 3).char).toBe("O");
  });
});
