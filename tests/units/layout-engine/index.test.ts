import { describe, it, expect } from "bun:test";
import { computeLayout, type LayoutInputNode } from "@/layout-engine";

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
});
