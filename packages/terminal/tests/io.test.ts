import { describe, expect, test } from "bun:test";
import { getTerminalSize } from "../src/io";

describe("@btuin/terminal", () => {
  test("getTerminalSize returns positive numbers", () => {
    const { cols, rows } = getTerminalSize();
    expect(cols).toBeGreaterThan(0);
    expect(rows).toBeGreaterThan(0);
  });
});
