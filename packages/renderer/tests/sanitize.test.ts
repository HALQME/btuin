import { describe, it, expect } from "bun:test";
import {
  sanitizeAnsi,
  sanitizeControl,
  sanitizeInput,
  isSafeInput,
  escapeSpecial,
  truncateInput,
  createSanitizer,
} from "../src/sanitize";

describe("Sanitization Utilities", () => {
  describe("sanitizeAnsi", () => {
    it("should remove ANSI color codes", () => {
      const dirty = "\x1b[31mRed\x1b[0m";
      expect(sanitizeAnsi(dirty)).toBe("Red");
    });

    it("should remove cursor movement codes", () => {
      const dirty = "Hello\x1b[5;10HWorld";
      expect(sanitizeAnsi(dirty)).toBe("HelloWorld");
    });
  });

  describe("sanitizeControl", () => {
    it("should remove control characters", () => {
      const dirty = "A\x00B\x08C\x1fD";
      expect(sanitizeControl(dirty)).toBe("ABCD");
    });

    it("should not remove common whitespace", () => {
      const clean = "A\tB\nC\rD";
      expect(sanitizeControl(clean)).toBe(clean);
    });
  });

  describe("sanitizeInput", () => {
    it("should remove both ANSI and control characters", () => {
      const dirty = "\x1b[32mGreen\x01Text\x1b[0m";
      expect(sanitizeInput(dirty)).toBe("GreenText");
    });
  });

  describe("isSafeInput", () => {
    it("should return true for safe strings", () => {
      expect(isSafeInput("Hello, world!")).toBe(true);
    });

    it("should return false for strings with ANSI codes", () => {
      expect(isSafeInput("\x1b[31mRed")).toBe(false);
    });

    it("should return false for strings with control characters", () => {
      expect(isSafeInput("Hello\x07")).toBe(false);
    });
  });

  describe("escapeSpecial", () => {
    it("should escape special characters", () => {
      const input = "[\x1b]";
      const expected = "\\[\\x1b\\]";
      expect(escapeSpecial(input)).toBe(expected);
    });
  });

  describe("truncateInput", () => {
    it("should truncate a string and add a suffix", () => {
      const input = "This is a long string";
      expect(truncateInput(input, 10)).toBe("This is...");
    });

    it("should not truncate if not needed", () => {
      const input = "Short";
      expect(truncateInput(input, 10)).toBe("Short");
    });

    it("should use a custom suffix", () => {
      const input = "Another long one";
      expect(truncateInput(input, 10, "!")).toBe("Another l!");
    });
  });

  describe("createSanitizer", () => {
    it("should create a sanitizer with default options", () => {
      const sanitizer = createSanitizer({});
      const dirty = "\x1b[1mBold\x02Text";
      expect(sanitizer(dirty)).toBe("BoldText");
    });

    it("should create a sanitizer with custom options", () => {
      const sanitizer = createSanitizer({
        removeAnsi: false,
        removeControl: true,
        maxLength: 5,
        trimWhitespace: true,
      });
      const dirty = "  \x1b[1mBold\x02Text  ";
      const expected = "\x1b[1mBoldT";
      expect(sanitizer(dirty)).toBe(expected);
    });
  });
});
