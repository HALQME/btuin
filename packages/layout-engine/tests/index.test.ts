import { describe, expect, test } from "bun:test";
import { computeLayout, initLayoutEngine, type LayoutInputNode } from "../src/index";

describe("@btuin/layout-engine", () => {
  test("computeLayout throws before initLayoutEngine", () => {
    expect(() => computeLayout({ type: "block" } as LayoutInputNode)).toThrow(/not initialized/i);
  });

  test("computeLayout returns stable positions after initLayoutEngine", async () => {
    await initLayoutEngine();

    const root: LayoutInputNode = {
      key: "root",
      type: "root",
      display: "flex",
      flexDirection: "row",
      width: 20,
      height: 5,
      children: [
        { key: "a", type: "leaf", width: 5, height: 1 },
        { key: "b", type: "leaf", width: 7, height: 1 },
      ],
    };

    const computed = computeLayout(root);
    expect(computed.root).toEqual({ x: 0, y: 0, width: 20, height: 5 });
    expect(computed.a).toEqual({ x: 0, y: 0, width: 5, height: 1 });
    expect(computed.b).toEqual({ x: 5, y: 0, width: 7, height: 1 });
  });

  test("gap affects layout after initLayoutEngine", async () => {
    await initLayoutEngine();

    const root: LayoutInputNode = {
      key: "root",
      type: "root",
      display: "flex",
      flexDirection: "row",
      gap: 2,
      width: 20,
      height: 5,
      children: [
        { key: "a", type: "leaf", width: 5, height: 1 },
        { key: "b", type: "leaf", width: 7, height: 1 },
      ],
    };

    const computed = computeLayout(root);
    expect(computed.a).toEqual({ x: 0, y: 0, width: 5, height: 1 });
    expect(computed.b).toEqual({ x: 7, y: 0, width: 7, height: 1 });
  });

  test("computeLayout throws when given invalid dimensions", async () => {
    await initLayoutEngine();

    const root: LayoutInputNode = {
      key: "root",
      type: "root",
      display: "flex",
      flexDirection: "row",
      // @ts-expect-error - purposely invalid input to verify error propagation
      width: { invalid: true },
      height: 5,
      children: [{ key: "a", type: "leaf", width: 1, height: 1 }],
    };

    expect(() => computeLayout(root)).toThrow(/failed/i);
  });
});
