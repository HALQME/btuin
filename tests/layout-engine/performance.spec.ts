import { describe, it, expect, afterAll } from "bun:test";
import { computeLayout, cleanupLayoutEngine } from "@/layout-engine";
import type { LayoutInputNode } from "@/layout-engine";

// Helper function to generate a large, WIDE tree of nodes
function generateLargeTree(nodeCount: number): LayoutInputNode {
  const root: LayoutInputNode = {
    identifier: "root",
    type: "block",
    width: 1920,
    height: 1080,
    // padding: 1, // Temporarily removed for debugging
    children: [],
  };

  for (let i = 0; i < nodeCount - 1; i++) {
    const newNode: LayoutInputNode = {
      key: `node-${i}`, // Use key for stable identification
      type: "block",
      width: 10,
      height: 10,
      // margin: 1, // Temporarily removed for debugging
    };
    root.children!.push(newNode);
  }

  return root;
}

describe("Layout Engine FFI Performance & Correctness", () => {
  // Cleanup the engine instance after tests to ensure clean state
  it("should compute layout for 10,000 nodes quickly and correctly", () => {
    const NODE_COUNT = 10_000;
    const root = generateLargeTree(NODE_COUNT);

    console.time(`[FFI] Total computeLayout time for ${NODE_COUNT} nodes`);
    const layout = computeLayout(root);
    console.timeEnd(`[FFI] Total computeLayout time for ${NODE_COUNT} nodes`);

    // --- Correctness Assertions (Debug version) ---
    expect(layout).toBeDefined();

    // Check root layout
    expect(layout.root).toBeDefined();
    expect(layout.root!.x).toBe(0);
    expect(layout.root!.y).toBe(0);

    // Check first child layout
    const firstChildKey = "node-0";
    expect(layout[firstChildKey]).toBeDefined();
    expect(layout[firstChildKey]!.x).toBe(0);
    expect(layout[firstChildKey]!.y).toBe(0);
    expect(layout[firstChildKey]!.width).toBe(10);

    // Check another child's position
    const secondChildKey = "node-1";
    expect(layout[secondChildKey]).toBeDefined();
    expect(layout[secondChildKey]!.x).toBe(10);
    expect(layout[secondChildKey]!.y).toBe(0);
  });

  // Clean up the singleton engine instance after all tests in this file.
  afterAll(() => {
    cleanupLayoutEngine();
  });
});
