import { describe, expect, test } from "bun:test";
import { HStack, VStack } from "../../src/view/layout";
import { Text } from "../../src/view/primitives";
import { initLayoutEngine, layout } from "../../src/layout/index";

describe("btuin layout centering", () => {
  test("justify:center centers children vertically in a column", async () => {
    await initLayoutEngine();

    const root = VStack([Text("Counter"), Text("Count: 0")])
      .width("100%")
      .height("100%")
      .justify("center")
      .align("center");

    const layoutMap = layout(root, { width: 100, height: 50 });

    const first = layoutMap["root/text-0"];
    const second = layoutMap["root/text-1"];

    expect(first).toBeDefined();
    expect(second).toBeDefined();

    expect(first!.y).toBeGreaterThanOrEqual(20);
    expect(first!.y).toBeLessThanOrEqual(30);
    expect(second!.y).toBeGreaterThan(first!.y);
  });

  test("blocks shrink to their content when not sized explicitly", async () => {
    await initLayoutEngine();

    const root = VStack([HStack([Text("A"), Text("B")]).gap(1)])
      .width("100%")
      .height(5)
      .justify("center")
      .align("center");

    const layoutMap = layout(root, { width: 20, height: 5 });
    const stack = layoutMap["root/block-0"];

    expect(stack).toBeDefined();
    expect(stack!.width).toBe(3);
  });
});
