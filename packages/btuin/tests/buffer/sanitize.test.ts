import { describe, it, expect } from "bun:test";
import {
  sanitizeAnsi,
  sanitizeControl,
  sanitizeInput,
  isSafeInput,
  escapeSpecial,
  truncateInput,
  createSanitizer,
} from "../../src/buffer/sanitize";

describe("Sanitization", () => {
  describe("sanitizeAnsi", () => {
    it("removes ANSI color codes", () => {
      const input = "\u001b[31mRed\u001b[0m";
      const result = sanitizeAnsi(input);
      expect(result).toBe("Red");
    });

    it("removes multiple ANSI codes", () => {
      const input = "\u001b[1m\u001b[31mBold Red\u001b[0m";
      const result = sanitizeAnsi(input);
      expect(result).toBe("Bold Red");
    });

    it("handles text without ANSI codes", () => {
      const input = "Plain text";
      const result = sanitizeAnsi(input);
      expect(result).toBe("Plain text");
    });

    it("removes cursor movement codes", () => {
      const input = "\u001b[5A\u001b[10CText";
      const result = sanitizeAnsi(input);
      expect(result).toBe("Text");
    });

    it("handles non-string input", () => {
      const result = sanitizeAnsi(123 as any);
      expect(result).toBe("123");
    });
  });

  describe("sanitizeControl", () => {
    it("removes control characters", () => {
      const input = "Text\x00With\x1FControl";
      const result = sanitizeControl(input);
      expect(result).toBe("TextWithControl");
    });

    it("preserves newlines", () => {
      const input = "Line1\nLine2\x00Line3";
      const result = sanitizeControl(input);
      expect(result).toContain("\n");
    });

    it("removes null bytes", () => {
      const input = "Safe\x00String";
      const result = sanitizeControl(input);
      expect(result).toBe("SafeString");
    });

    it("handles non-string input", () => {
      const result = sanitizeControl(456 as any);
      expect(result).toBe("456");
    });
  });

  describe("sanitizeInput", () => {
    it("removes both ANSI and control characters", () => {
      const input = "\u001b[31mText\x00With\x1FControl\u001b[0m";
      const result = sanitizeInput(input);
      expect(result).toBe("TextWithControl");
    });

    it("handles empty string", () => {
      const result = sanitizeInput("");
      expect(result).toBe("");
    });

    it("handles string with only ANSI codes", () => {
      const input = "\u001b[31m\u001b[0m";
      const result = sanitizeInput(input);
      expect(result).toBe("");
    });

    it("handles string with only control chars", () => {
      const input = "\x00\x1F\x7F";
      const result = sanitizeInput(input);
      expect(result).toBe("");
    });
  });

  describe("isSafeInput", () => {
    it("returns true for safe input", () => {
      expect(isSafeInput("Hello World")).toBe(true);
    });

    it("returns false for input with ANSI codes", () => {
      expect(isSafeInput("\u001b[31mRed\u001b[0m")).toBe(false);
    });

    it("returns false for input with control characters", () => {
      expect(isSafeInput("Text\x00Control")).toBe(false);
    });

    it("returns false for non-string input", () => {
      expect(isSafeInput(123 as any)).toBe(false);
    });

    it("returns true for empty string", () => {
      expect(isSafeInput("")).toBe(true);
    });
  });

  describe("escapeSpecial", () => {
    it("escapes backslash", () => {
      const result = escapeSpecial("path\\to\\file");
      expect(result).toContain("\\\\");
    });

    it("escapes escape character", () => {
      const result = escapeSpecial("\x1b");
      expect(result).toBe("\\x1b");
    });

    it("escapes square brackets", () => {
      const result = escapeSpecial("[31m");
      expect(result).toBe("\\[31m");
    });

    it("handles non-string input", () => {
      const result = escapeSpecial(789 as any);
      expect(result).toBe("789");
    });
  });

  describe("truncateInput", () => {
    it("truncates long input", () => {
      const result = truncateInput("Hello, World!", 5);
      expect(result.length).toBeLessThanOrEqual(8); // 5 chars + "..."
    });

    it("preserves short input", () => {
      const result = truncateInput("Hi", 10);
      expect(result).toBe("Hi");
    });

    it("uses custom suffix", () => {
      const result = truncateInput("Hello, World!", 5, "..");
      expect(result).toContain("..");
    });

    it("handles zero max length", () => {
      const result = truncateInput("Test", 0);
      expect(result).toContain("...");
    });

    it("handles non-string input", () => {
      const result = truncateInput(12345 as any, 3);
      expect(result).toBeDefined();
    });
  });

  describe("createSanitizer", () => {
    it("creates sanitizer with ANSI removal", () => {
      const sanitizer = createSanitizer({ removeAnsi: true });
      const result = sanitizer("\u001b[31mRed\u001b[0m");
      expect(result).toBe("Red");
    });

    it("creates sanitizer with control char removal", () => {
      const sanitizer = createSanitizer({ removeControl: true });
      const result = sanitizer("Text\x00Control");
      expect(result).toBe("TextControl");
    });

    it("creates sanitizer with max length", () => {
      const sanitizer = createSanitizer({ maxLength: 5 });
      const result = sanitizer("Hello, World!");
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it("creates sanitizer with trim whitespace", () => {
      const sanitizer = createSanitizer({ trimWhitespace: true });
      const result = sanitizer("  Hello  ");
      expect(result).toBe("Hello");
    });

    it("combines multiple options", () => {
      const sanitizer = createSanitizer({
        removeAnsi: true,
        removeControl: true,
        trimWhitespace: true,
        maxLength: 10,
      });
      const result = sanitizer("  \u001b[31mHello\x00World\u001b[0m  ");
      expect(result).toBeDefined();
      expect(result.length).toBeLessThanOrEqual(10);
    });
  });

  describe("Security", () => {
    it("prevents ANSI injection attacks", () => {
      const malicious = "\u001b[0m\u001b[31mInjected";
      const safe = sanitizeInput(malicious);
      expect(safe).toBe("Injected");
      expect(safe).not.toContain("\u001b");
    });

    it("prevents control character injection", () => {
      const malicious = "Text\x1B\x5B\x31\x3B\x31H";
      const safe = sanitizeInput(malicious);
      expect(safe).not.toContain("\x1B");
    });

    it("handles terminal hijacking attempts", () => {
      const hijack = "\u001b[2J\u001b[H";
      const safe = sanitizeInput(hijack);
      expect(safe).toBe("");
    });

    it("handles cursor positioning attacks", () => {
      const attack = "Safe\u001b[100;100HUnsafe";
      const safe = sanitizeInput(attack);
      expect(safe).toBe("SafeUnsafe");
    });
  });

  describe("Performance", () => {
    it("handles large input efficiently", () => {
      const largeInput = "A".repeat(10000);
      const start = performance.now();
      const result = sanitizeInput(largeInput);
      const elapsed = performance.now() - start;

      expect(result.length).toBe(10000);
      expect(elapsed).toBeLessThan(100);
    });

    it("handles many ANSI codes efficiently", () => {
      let input = "";
      for (let i = 0; i < 1000; i++) {
        input += `\u001b[${i}mText\u001b[0m`;
      }

      const start = performance.now();
      const result = sanitizeAnsi(input);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(500);
    });
  });
});
