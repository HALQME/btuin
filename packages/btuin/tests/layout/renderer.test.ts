import { describe, expect, test } from "bun:test";
import { createBuffer } from "@btuin/renderer";
import { HStack } from "../../src/view/layout";
import { VStack } from "../../src/view/layout";
import { Text } from "../../src/view/primitives";
import { initLayoutEngine, layout } from "../../src/layout/index";
import { renderElement } from "../../src/layout/renderer";

function bufferToString(buf: { rows: number; cols: number; cells: Uint32Array }): string {
  let out = "";
  for (let r = 0; r < buf.rows; r++) {
    for (let c = 0; c < buf.cols; c++) {
      out += String.fromCodePoint(buf.cells[r * buf.cols + c]!);
    }
    out += "\n";
  }
  return out;
}

describe("btuin renderElement", () => {
  test("renders outlined HStack without crashing", async () => {
    await initLayoutEngine();

    const a = Text("A");
    a.key = "a";
    const b = Text("B");
    b.key = "b";

    const root = HStack([a, b]).gap(1).outline({ color: "blue" }).width(10).height(3);

    const layoutMap = layout(root);
    const buf = createBuffer(3, 10);

    expect(() => renderElement(root, buf, layoutMap)).not.toThrow();
    expect(String.fromCodePoint(buf.cells[buf.index(0, 0)]!)).toBe("┌");
  });

  test("renders text inside outlined containers", async () => {
    await initLayoutEngine();

    const root = VStack([Text("Counter"), Text("Count: 0")])
      .outline({ color: "blue" })
      .width(20)
      .height(6);

    const layoutMap = layout(root);
    const buf = createBuffer(6, 20);
    renderElement(root, buf, layoutMap);

    expect(bufferToString(buf)).toContain("Counter");
  });

  test("resolves root 100% size from container", async () => {
    await initLayoutEngine();

    const root = VStack([Text("X")])
      .width("100%")
      .height("100%");
    const layoutMap = layout(root, { width: 10, height: 6 });

    expect(layoutMap[root.key!]?.width).toBe(10);
    expect(layoutMap[root.key!]?.height).toBe(6);
  });

  test("draws nested children with parent offsets", async () => {
    await initLayoutEngine();

    const nestedText = Text("C");
    const nested = HStack([nestedText]);
    const root = VStack([Text("Header"), nested])
      .width(12)
      .height(5)
      .justify("flex-start")
      .align("flex-start");

    const layoutMap = layout(root, { width: 12, height: 5 });
    const buf = createBuffer(5, 12);
    renderElement(root, buf, layoutMap);

    const nestedLayout = layoutMap[nested.key!];
    const textLayout = layoutMap[nestedText.key!];
    expect(nestedLayout).toBeDefined();
    expect(textLayout).toBeDefined();

    const targetRow = nestedLayout!.y + textLayout!.y;
    const targetCol = nestedLayout!.x + textLayout!.x;
    const charCode = buf.cells[targetRow * buf.cols + targetCol];

    expect(String.fromCodePoint(charCode!)).toBe("C");
  });
});
