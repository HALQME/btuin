import { describe, it, expect } from "bun:test";
import { computeLayout } from "@/layout-engine";
import type { LayoutInputNode } from "@/types";

describe("Layout Engine - Alignment", () => {
  it("should center children vertically with justify(center) in column layout", () => {
    // VStack(column) with justify(center) should center children vertically
    const root: LayoutInputNode = {
      identifier: "root",
      type: "block",
      width: 100,
      height: 100,
      flexDirection: "column",
      justifyContent: "center",
      children: [
        {
          identifier: "child",
          type: "block",
          width: 50,
          height: 20,
        },
      ],
    };

    const layout = computeLayout(root);

    expect(layout.root).toBeDefined();
    expect(layout.root?.width).toBe(100);
    expect(layout.root?.height).toBe(100);

    expect(layout.child).toBeDefined();
    // Child should be centered vertically in a 100px container with 20px height
    // (100 - 20) / 2 = 40
    expect(layout.child?.y).toBe(40);
    expect(layout.child?.x).toBe(0);
  });

  it("should center children horizontally with align(center) in column layout", () => {
    // VStack(column) with align(center) should center children horizontally
    const root: LayoutInputNode = {
      identifier: "root",
      type: "block",
      width: 100,
      height: 100,
      flexDirection: "column",
      alignItems: "center",
      children: [
        {
          identifier: "child",
          type: "block",
          width: 50,
          height: 20,
        },
      ],
    };

    const layout = computeLayout(root);

    expect(layout.root).toBeDefined();
    expect(layout.child).toBeDefined();
    // Child should be centered horizontally in a 100px container with 50px width
    // (100 - 50) / 2 = 25
    expect(layout.child?.x).toBe(25);
    expect(layout.child?.y).toBe(0);
  });

  it("should center children both ways with justify(center) and align(center) in column layout", () => {
    // VStack with both justify and align center
    const root: LayoutInputNode = {
      identifier: "root",
      type: "block",
      width: 100,
      height: 100,
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      children: [
        {
          identifier: "child",
          type: "block",
          width: 50,
          height: 20,
        },
      ],
    };

    const layout = computeLayout(root);

    expect(layout.root).toBeDefined();
    expect(layout.child).toBeDefined();
    // Child should be centered both horizontally and vertically
    expect(layout.child?.x).toBe(25); // (100 - 50) / 2
    expect(layout.child?.y).toBe(40); // (100 - 20) / 2
  });

  it("should center children horizontally with justify(center) in row layout", () => {
    // HStack(row) with justify(center) should center children horizontally
    const root: LayoutInputNode = {
      identifier: "root",
      type: "block",
      width: 100,
      height: 100,
      flexDirection: "row",
      justifyContent: "center",
      children: [
        {
          identifier: "child",
          type: "block",
          width: 50,
          height: 20,
        },
      ],
    };

    const layout = computeLayout(root);

    expect(layout.root).toBeDefined();
    expect(layout.child).toBeDefined();
    // Child should be centered horizontally in a 100px container with 50px width
    expect(layout.child?.x).toBe(25);
    expect(layout.child?.y).toBe(0);
  });

  it("should center children vertically with align(center) in row layout", () => {
    // HStack(row) with align(center) should center children vertically
    const root: LayoutInputNode = {
      identifier: "root",
      type: "block",
      width: 100,
      height: 100,
      flexDirection: "row",
      alignItems: "center",
      children: [
        {
          identifier: "child",
          type: "block",
          width: 50,
          height: 20,
        },
      ],
    };

    const layout = computeLayout(root);

    expect(layout.root).toBeDefined();
    expect(layout.child).toBeDefined();
    // Child should be centered vertically in a 100px container with 20px height
    expect(layout.child?.y).toBe(40);
    expect(layout.child?.x).toBe(0);
  });

  it("should handle flex-end justification", () => {
    const root: LayoutInputNode = {
      identifier: "root",
      type: "block",
      width: 100,
      height: 100,
      flexDirection: "column",
      justifyContent: "flex-end",
      children: [
        {
          identifier: "child",
          type: "block",
          width: 50,
          height: 20,
        },
      ],
    };

    const layout = computeLayout(root);

    expect(layout.child).toBeDefined();
    // Child should be at the bottom: 100 - 20 = 80
    expect(layout.child?.y).toBe(80);
  });

  it("should handle flex-end alignment", () => {
    const root: LayoutInputNode = {
      identifier: "root",
      type: "block",
      width: 100,
      height: 100,
      flexDirection: "column",
      alignItems: "flex-end",
      children: [
        {
          identifier: "child",
          type: "block",
          width: 50,
          height: 20,
        },
      ],
    };

    const layout = computeLayout(root);

    expect(layout.child).toBeDefined();
    // Child should be at the right: 100 - 50 = 50
    expect(layout.child?.x).toBe(50);
  });

  it("should handle percentage dimensions", () => {
    const root: LayoutInputNode = {
      identifier: "root",
      type: "block",
      width: 100,
      height: 100,
      children: [
        {
          identifier: "child",
          type: "block",
          width: "50%",
          height: "50%",
        },
      ],
    };

    const layout = computeLayout(root);

    expect(layout.child).toBeDefined();
    expect(layout.child?.width).toBe(50);
    expect(layout.child?.height).toBe(50);
  });
});
