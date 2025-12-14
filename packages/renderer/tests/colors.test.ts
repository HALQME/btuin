import { describe, it, expect } from "bun:test";
import { resolveColor } from "../src/colors";

describe("resolveColor", () => {
  // Test named colors
  it("should resolve named foreground colors", () => {
    expect(resolveColor("red", "fg")).toBe("\x1b[31m");
    expect(resolveColor("black", "fg")).toBe("\x1b[30m");
    expect(resolveColor("GREEN", "fg")).toBe("\x1b[32m");
  });

  it("should resolve named background colors", () => {
    expect(resolveColor("blue", "bg")).toBe("\x1b[44m");
    expect(resolveColor("black", "bg")).toBe("\x1b[40m");
    expect(resolveColor("WHITE", "bg")).toBe("\x1b[47m");
  });

  // Test 256-color palette
  it("should resolve 256-color foreground", () => {
    expect(resolveColor(196, "fg")).toBe("\x1b[38;5;196m");
  });

  it("should resolve 256-color background", () => {
    expect(resolveColor(88, "bg")).toBe("\x1b[48;5;88m");
  });

  // Test direct ANSI codes
  it("should handle direct ANSI codes for foreground", () => {
    const code = "\x1b[38;2;100;200;50m";
    expect(resolveColor(code, "fg")).toBe(code);
  });

  it("should adapt direct ANSI codes for background", () => {
    const fgCode = "\x1b[38;2;100;200;50m";
    const bgCode = "\x1b[48;2;100;200;50m";
    // This is a simplification; the real implementation might need to be more robust
    // but based on the current implementation, this is the expected behavior.
    expect(resolveColor(fgCode, "bg")).toBe(fgCode.replace("[38;", "[48;"));
  });

  // Test invalid input
  it("should return undefined for invalid color names", () => {
    expect(resolveColor("not-a-color", "fg")).toBeUndefined();
  });

  // Test case insensitivity
  it("should be case-insensitive for named colors", () => {
    expect(resolveColor("MaGeNtA", "fg")).toBe("\x1b[35m");
    expect(resolveColor("cYaN", "bg")).toBe("\x1b[46m");
  });
});
