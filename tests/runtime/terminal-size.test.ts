import { describe, expect, test } from "bun:test";
import { getTerminalSize } from "@/terminal";
import { VStack } from "../../src/view/layout";
import { Text } from "../../src/view/primitives";
import { layout } from "../../src/layout";

describe("runtime terminal size propagation", () => {
  test("getTerminalSize returns usable cols/rows in tests", () => {
    const { cols, rows } = getTerminalSize();
    expect(Number.isFinite(cols)).toBe(true);
    expect(Number.isFinite(rows)).toBe(true);
    expect(cols).toBeGreaterThan(0);
    expect(rows).toBeGreaterThan(0);
  });

  test("layout root 100% resolves to terminal cols/rows", async () => {
    const { cols, rows } = getTerminalSize();

    const root = VStack([Text("Counter"), Text("Count: 0")])
      .width("100%")
      .height("100%")
      .justify("center")
      .align("center");

    const computed = layout(root, { width: cols, height: rows });

    expect(computed["root"]?.width).toBe(80);
    expect(computed["root"]?.height).toBe(24);
  });
});
