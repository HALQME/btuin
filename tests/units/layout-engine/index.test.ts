import { describe, it, expect } from "bun:test";
import { computeLayout } from "@/layout-engine";
import type { LayoutInputNode } from "@/types";

describe("Layout Engine", () => {
  it("should compute a simple layout", () => {
    const root: LayoutInputNode = {
      identifier: "root",
      type: "block",
      width: 100,
      height: 100,
      children: [
        {
          identifier: "child1",
          type: "block",
          width: 50,
          height: 50,
        },
        {
          identifier: "child2",
          type: "block",
          width: 50,
          height: 50,
          flexGrow: 1,
        },
      ],
    };

    const layout = computeLayout(root);

    expect(layout.root).toBeDefined();
    expect(layout.root?.width).toBe(100);
    expect(layout.root?.height).toBe(100);
    expect(layout.root?.x).toBe(0);
    expect(layout.root?.y).toBe(0);

    expect(layout.child1).toBeDefined();
    expect(layout.child1?.width).toBe(50);
    expect(layout.child1?.height).toBe(50);
    expect(layout.child1?.x).toBe(0);
    expect(layout.child1?.y).toBe(0);

    expect(layout.child2).toBeDefined();
    // The default flexDirection is row.
    // So child2 will be to the right of child1.
    expect(layout.child2?.width).toBe(50);
    expect(layout.child2?.height).toBe(50);
    expect(layout.child2?.x).toBe(50);
    expect(layout.child2?.y).toBe(0);
  });

  it("should compute flex layout", () => {
    const root: LayoutInputNode = {
      identifier: "root",
      type: "block",
      width: 200,
      height: 100,
      flexDirection: "row",
      padding: 10,
      gap: 10,
      children: [
        {
          identifier: "child1",
          type: "block",
          width: 50,
          height: 50,
        },
        {
          identifier: "child2",
          type: "block",
          flexGrow: 1,
          height: 50,
        },
      ],
    };

    const layout = computeLayout(root);

    expect(layout.root).toBeDefined();
    expect(layout.root?.width).toBe(200);
    expect(layout.root?.height).toBe(100);

    expect(layout.child1).toBeDefined();
    expect(layout.child1?.width).toBe(50);
    expect(layout.child1?.height).toBe(50);
    expect(layout.child1?.x).toBe(10);
    expect(layout.child1?.y).toBe(10);

    // child2 should be to the right of child1, with a gap.
    // The available width for children is 200 - 2*10 (padding) = 180.
    // child1 takes 50. Gap is 10. Remaining space is 180 - 50 - 10 = 120.
    // child2 has flexGrow: 1, so it takes all remaining space.
    expect(layout.child2).toBeDefined();
    expect(layout.child2?.width).toBe(120);
    expect(layout.child2?.height).toBe(50);
    expect(layout.child2?.x).toBe(10 + 50 + 10); // root.padding + child1.width + gap
    expect(layout.child2?.y).toBe(10);
  });

  it("should apply incremental updates and removals", () => {
    const root1: LayoutInputNode = {
      identifier: "root",
      type: "block",
      width: 10,
      height: 10,
      flexDirection: "column",
      children: [
        {
          identifier: "a",
          type: "block",
          width: 10,
          height: 1,
        },
        {
          identifier: "b",
          type: "block",
          width: 10,
          height: 1,
        },
      ],
    };

    const layout1 = computeLayout(root1);
    expect(layout1.a).toBeDefined();
    expect(layout1.b).toBeDefined();

    const root2: LayoutInputNode = {
      identifier: "root",
      type: "block",
      width: 10,
      height: 10,
      flexDirection: "column",
      children: [
        {
          identifier: "a",
          type: "block",
          width: 10,
          height: 2,
        },
      ],
    };

    const layout2 = computeLayout(root2);
    expect(layout2.a?.height).toBe(2);
    expect(layout2.b).toBeUndefined();
  });

  it("should maintain positions of non-leaf nodes (nested containers)", () => {
    const root: LayoutInputNode = {
      identifier: "root",
      type: "block",
      width: 100,
      height: 100,
      flexDirection: "column",
      children: [
        {
          identifier: "container",
          type: "block",
          width: 100,
          height: 50,
          padding: 10,
          children: [
            {
              identifier: "item",
              type: "block",
              width: 10,
              height: 10,
            },
          ],
        },
      ],
    };

    const layout = computeLayout(root);

    expect(layout.root?.x).toBe(0);
    expect(layout.root?.y).toBe(0);

    // This was failing before the fix (it was being reset to x:0, y:0)
    expect(layout.container).toBeDefined();
    expect(layout.container?.x).toBe(0);
    expect(layout.container?.y).toBe(0);

    expect(layout.item).toBeDefined();
    expect(layout.item?.x).toBe(10); // container.padding-left
    expect(layout.item?.y).toBe(10); // container.padding-top

    // Test with a container that has an offset
    const root2: LayoutInputNode = {
      identifier: "root",
      type: "block",
      width: 100,
      height: 100,
      flexDirection: "column",
      children: [
        {
          identifier: "spacer",
          type: "block",
          width: 100,
          height: 10,
        },
        {
          identifier: "nested",
          type: "block",
          width: 100,
          height: 20,
          children: [
            {
              identifier: "leaf",
              type: "block",
              width: 5,
              height: 5,
            },
          ],
        },
      ],
    };

    const layout2 = computeLayout(root2);
    expect(layout2.nested?.y).toBe(10); // After spacer
    expect(layout2.leaf?.y).toBe(0);    // relative to parent nested (0,0)
  });
});
