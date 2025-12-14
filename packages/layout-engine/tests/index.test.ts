import { describe, expect, test } from "bun:test";
import { computeLayout, type LayoutInputNode } from "../src/index";

describe("@btuin/layout-engine", () => {
  test("computeLayout throws before initLayoutEngine", () => {
    expect(() => computeLayout({ type: "block" } as LayoutInputNode)).toThrow(/not initialized/i);
  });
});
