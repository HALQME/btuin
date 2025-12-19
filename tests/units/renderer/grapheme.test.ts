import { describe, expect, it } from "bun:test";
import {
  measureGraphemeWidth,
  measureTextWidth,
  segmentGraphemes,
  truncateTextWidth,
  wrapTextWidth,
} from "@/renderer/grapheme";

describe("grapheme helpers", () => {
  it("segments ascii and combining sequences", () => {
    const text = "a\u0301b";
    const segments = segmentGraphemes(text);
    expect(segments).toEqual(["a\u0301", "b"]);
  });

  it("handles Kanji as two width", () => {
    const kanji = "饅";
    const segments = segmentGraphemes(kanji);
    expect(measureGraphemeWidth(segments[0]!)).toBe(2);
  });

  it("handles emoji sequences as single graphemes", () => {
    const emoji = "👨‍👩‍👧‍👦";
    const segments = segmentGraphemes(emoji);
    expect(segments[0]?.startsWith("👨")).toBe(true);
    expect(measureGraphemeWidth(segments[0]!)).toBe(2);
  });

  it("measures control characters as zero width", () => {
    expect(measureGraphemeWidth("\u0007")).toBe(0);
  });

  it("reports width 1 for normal latin glyphs", () => {
    expect(measureGraphemeWidth("A")).toBe(1);
  });

  it("measures text width by grapheme display width", () => {
    expect(measureTextWidth("a饅b")).toBe(4);
  });

  it("truncates by display width", () => {
    // Each Kanji is width 2, ellipsis is width 1 -> 2 + 2 + 1 = 5
    expect(truncateTextWidth("饅饅饅", 5)).toBe("饅饅…");
  });

  it("wraps text by display width", () => {
    expect(wrapTextWidth("Hello world", 5)).toEqual(["Hello", "world"]);
    expect(wrapTextWidth("饅饅饅", 2)).toEqual(["饅", "饅", "饅"]);
  });
});
