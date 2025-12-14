import { describe, it, expect } from "bun:test";
import { createLayout } from "../../src/layout";
import { Block, Text } from "../../src/view/primitives";
import type { LayoutInputNode, ComputedLayout } from "@btuin/layout-engine";

// Mock the layout engine
let receivedLayoutNode: LayoutInputNode | null = null;
const mockComputedLayout: ComputedLayout = {
  root: { x: 0, y: 0, width: 80, height: 24 },
  "root/block-0": { x: 0, y: 0, width: 80, height: 24 },
  "root/block-0/text-0": { x: 35, y: 12, width: 10, height: 1 },
};

describe("layout", () => {
  it("should convert ViewElement tree to LayoutInputNode tree and compute layout", () => {
    const { layout } = createLayout({
      initLayoutEngine: async () => {},
      computeLayout: (node: LayoutInputNode): ComputedLayout => {
        receivedLayoutNode = node;
        return mockComputedLayout;
      },
    });

    const root = Block(Text({ value: "Hello" }))
      .justify("center")
      .align("center");

    const computed = layout(root, { width: 80, height: 24 });

    // Check that the layout function passed the correct node to the engine
    expect(receivedLayoutNode).not.toBeNull();
    expect(receivedLayoutNode?.key).toBe("root");
    expect(receivedLayoutNode?.justifyContent).toBe("center");
    expect(receivedLayoutNode?.alignItems).toBe("center");

    const textNode = receivedLayoutNode?.children?.[0];
    expect(textNode).toBeDefined();
    expect(textNode?.key).toBe("root/text-0");
    expect(textNode?.type).toBe("text");
    expect(textNode?.measuredSize).toEqual({ width: 5, height: 1 });

    // Check that the layout function returns the computed layout
    expect(computed).toEqual(mockComputedLayout);
  });

  it("should assign keys to elements without them", () => {
    const { layout } = createLayout({
      initLayoutEngine: async () => {},
      computeLayout: (node: LayoutInputNode): ComputedLayout => {
        receivedLayoutNode = node;
        return mockComputedLayout;
      },
    });

    const root = Block(Block(Text({ value: "test" })));
    layout(root);

    expect(receivedLayoutNode?.key).toBe("root");
    const child1 = receivedLayoutNode?.children?.[0];
    expect(child1?.key).toBe("root/block-0");
    const child2 = child1?.children?.[0];
    expect(child2?.key).toBe("root/block-0/text-0");
  });

  it("should resolve root size", () => {
    const { layout } = createLayout({
      initLayoutEngine: async () => {},
      computeLayout: (node: LayoutInputNode): ComputedLayout => {
        receivedLayoutNode = node;
        return mockComputedLayout;
      },
    });

    const root = Block();
    layout(root, { width: 100, height: 50 });

    expect(receivedLayoutNode?.width).toBe(100);
    expect(receivedLayoutNode?.height).toBe(50);
  });
});
