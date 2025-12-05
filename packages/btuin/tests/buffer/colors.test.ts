import { describe, it, expect, afterEach } from "bun:test";
import { resolveColor } from "../../src/buffer";

describe("resolveColor", () => {
  const originalColor = Bun.color;

  afterEach(() => {
    Bun.color = originalColor;
  });

  function stubColor(result: string | null) {
    Bun.color = ((input: any, outputFormat?: any) => result) as unknown as typeof Bun.color;
  }

  it("maps named colors to foreground and background sequences", () => {
    stubColor("\x1b[38;2;1;2;3m");
    expect(resolveColor("magenta", "fg")).toMatch(/\x1b\[/);
    expect(resolveColor("magenta", "bg")).toMatch(/\x1b\[/);
  });

  it("formats numeric values as 256-color escape codes", () => {
    expect(resolveColor(42, "fg")).toBe("\x1b[38;5;42m");
    expect(resolveColor(42, "bg")).toBe("\x1b[48;5;42m");
  });

  it("returns the same when escape sequences provided", () => {
    expect(resolveColor("\x1b[38;5;123m", "fg")).toBe("\x1b[38;5;123m");
    expect(resolveColor("\x1b[38;5;123m", "bg")).toBe("\x1b[48;5;123m");
  });

  it("falls back to Bun.color for arbitrary strings", () => {
    stubColor("\x1b[38;2;1;2;3m");
    expect(resolveColor("#010203", "fg")).toBe("\x1b[38;2;1;2;3m");
    expect(resolveColor("#010203", "bg")).toBe("\x1b[48;2;1;2;3m");
  });

  it("returns undefined for invalid entries", () => {
    stubColor(null);
    expect(resolveColor("not-a-color", "fg")).toBeUndefined();
  });
});
