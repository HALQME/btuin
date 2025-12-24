import { describe, it, expect } from "bun:test";
import { collectFocusTargets } from "@/layout/focus";
import { Block, Text } from "@/view/primitives";
import type { ComputedLayout, ViewElement } from "@/types";

describe("collectFocusTargets", () => {
  it("should collect focusable elements from a simple tree", () => {
    const root: ViewElement = Block(
      Text({ value: "Foo" }).focus("text1").build(),
      Block(Text({ value: "Bar" }).focus("text2").build())
        .setKey("inner-block")
        .build(),
    )
      .setKey("root")
      .build();

    const layoutMap: ComputedLayout = {
      root: { x: 0, y: 0, width: 20, height: 2 },
      "root/text-0": { x: 1, y: 0, width: 3, height: 1 },
      "inner-block": { x: 0, y: 1, width: 20, height: 1 },
      "inner-block/text-0": { x: 5, y: 0, width: 3, height: 1 },
    };

    const targets = collectFocusTargets(root, layoutMap);

    expect(targets.length).toBe(2);

    const target1 = targets.find((t) => t.focusKey === "text1");
    expect(target1).toBeDefined();
    expect(target1?.rect).toEqual({ x: 1, y: 0, width: 3, height: 1 });

    const target2 = targets.find((t) => t.focusKey === "text2");
    expect(target2).toBeDefined();
    // absX = parentX(0) + layout.x(0) + child.layout.x(5) = 5
    // absY = parentY(0) + layout.y(1) + child.layout.y(0) = 1
    expect(target2?.rect).toEqual({ x: 5, y: 1, width: 3, height: 1 });
  });

  it("should return an empty array if no elements are focusable", () => {
    const root: ViewElement = Block(Text({ value: "Foo" }).build())
      .setKey("root")
      .build();
    const layoutMap: ComputedLayout = {
      root: { x: 0, y: 0, width: 10, height: 1 },
      "root/text-0": { x: 0, y: 0, width: 3, height: 1 },
    };

    const targets = collectFocusTargets(root, layoutMap);
    expect(targets).toEqual([]);
  });

  it("should not collect targets if they have no layout", () => {
    const root: ViewElement = Block(
      Text({ value: "I have no key and no layout" }).focus("unreachable").build(),
    )
      .setKey("root")
      .build();

    const layoutMap: ComputedLayout = {
      root: { x: 0, y: 0, width: 10, height: 1 },
    };
    const targets = collectFocusTargets(root, layoutMap);
    expect(targets.length).toBe(0);
  });
});
