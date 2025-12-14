/**
 * Input sanitization utilities for btuin
 * Removes ANSI escape sequences and other potentially harmful input
 */

/**
 * Regular expression to match ANSI escape sequences
 * Matches sequences like: \x1b[...m, \u001b[...H, etc.
 */
const ESC = String.fromCharCode(0x1b);
const CSI = `${ESC}\\[`;
const ANSI_ESCAPE_REGEX = new RegExp(
  `${CSI}[0-9;]*m|${CSI}[^m]*m|${CSI}[0-9;]*[A-Za-z]|${CSI}[^A-Za-z]*[A-Za-z]`,
  "g",
);

/**
 * Regular expression to match other control characters (except common whitespace)
 */
const CONTROL_RANGES: [number, number][] = [
  [0x00, 0x08],
  [0x0b, 0x0c],
  [0x0e, 0x1a],
  [0x1c, 0x1f],
];
const CONTROL_CHAR_CLASS =
  CONTROL_RANGES.map(
    ([start, end]) => `${String.fromCharCode(start)}-${String.fromCharCode(end)}`,
  ).join("") + String.fromCharCode(0x7f);
const CONTROL_CHAR_REGEX = new RegExp(`[${CONTROL_CHAR_CLASS}]`, "g");

/**
 * Sanitizes input by removing ANSI escape sequences
 * @param input - The input string to sanitize
 * @returns Sanitized string with ANSI sequences removed
 *
 * @example
 * ```typescript
 * const dirty = "\x1b[31mRed Text\x1b[0m";
 * const clean = sanitizeAnsi(dirty);
 * // Result: "Red Text"
 * ```
 */
export function sanitizeAnsi(input: string): string {
  if (typeof input !== "string") {
    return String(input);
  }
  return input.replace(ANSI_ESCAPE_REGEX, "");
}

/**
 * Sanitizes input by removing control characters (except whitespace)
 * @param input - The input string to sanitize
 * @returns Sanitized string with control characters removed
 *
 * @example
 * ```typescript
 * const dirty = "Text\x00With\x1FControl";
 * const clean = sanitizeControl(dirty);
 * // Result: "TextWithControl"
 * ```
 */
export function sanitizeControl(input: string): string {
  if (typeof input !== "string") {
    return String(input);
  }
  return input.replace(CONTROL_CHAR_REGEX, "");
}

/**
 * Sanitizes input by removing both ANSI escape sequences and control characters
 * This is the most comprehensive sanitization
 * @param input - The input string to sanitize
 * @returns Fully sanitized string
 *
 * @example
 * ```typescript
 * const dirty = "\x1b[31mText\x00With\x1FControl\x1b[0m";
 * const clean = sanitizeInput(dirty);
 * // Result: "TextWithControl"
 * ```
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== "string") {
    return String(input);
  }
  return sanitizeControl(sanitizeAnsi(input));
}

/**
 * Validates that input is safe for terminal display
 * @param input - The input string to validate
 * @returns true if input is safe, false if it contains harmful sequences
 *
 * @example
 * ```typescript
 * const isSafe = isSafeInput("Hello World");
 * // Result: true
 * ```
 */
export function isSafeInput(input: string): boolean {
  if (typeof input !== "string") {
    return false;
  }
  return !ANSI_ESCAPE_REGEX.test(input) && !CONTROL_CHAR_REGEX.test(input);
}

/**
 * Escapes special characters that could be interpreted as ANSI codes
 * @param input - The input string to escape
 * @returns String with special characters escaped
 *
 * @example
 * ```typescript
 * const escaped = escapeSpecial("[31m");
 * // Result: "\\[31m"
 * ```
 */
export function escapeSpecial(input: string): string {
  if (typeof input !== "string") {
    return String(input);
  }
  // Escape characters that could form escape sequences
  return input
    .replace(/\\/g, "\\\\")
    .replace(new RegExp(ESC, "g"), "\\x1b")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]");
}

/**
 * Truncates input to maximum length while preserving readability
 * @param input - The input string to truncate
 * @param maxLength - Maximum length of output string
 * @param suffix - Suffix to add if truncated (default: "...")
 * @returns Truncated string
 *
 * @example
 * ```typescript
 * const truncated = truncateInput("Hello, World!", 5, "..");
 * // Result: "Hello.."
 * ```
 */
export function truncateInput(input: string, maxLength: number, suffix: string = "..."): string {
  if (typeof input !== "string") {
    input = String(input);
  }
  if (input.length <= maxLength) {
    return input;
  }
  const suffixLen = suffix.length;
  const truncateLen = Math.max(0, maxLength - suffixLen);
  return input.slice(0, truncateLen) + suffix;
}

function truncateVisibleWithAnsi(input: string, maxLength: number): string {
  const cap = Math.max(0, Math.floor(maxLength));
  if (cap === 0) {
    return "";
  }

  const ansiRegex = new RegExp(ANSI_ESCAPE_REGEX.source, "g");
  const ansiMatches: RegExpMatchArray[] = [];
  let match: RegExpMatchArray | null;
  while ((match = ansiRegex.exec(input)) !== null) {
    ansiMatches.push(match);
  }

  let result = "";
  let visibleCount = 0;
  let index = 0;
  let matchIndex = 0;

  while (index < input.length && visibleCount < cap) {
    const nextMatch = ansiMatches[matchIndex];
    const nextIndex = nextMatch?.index ?? -1;
    if (nextMatch && nextIndex === index) {
      result += nextMatch[0];
      index += nextMatch[0].length;
      matchIndex++;
      continue;
    }

    result += input[index];
    visibleCount++;
    index++;
  }

  while (matchIndex < ansiMatches.length) {
    const currentMatch = ansiMatches[matchIndex]!;
    const currentIndex = currentMatch.index ?? -1;
    if (currentIndex !== index) {
      break;
    }
    const seq = currentMatch[0];
    result += seq;
    index += seq.length;
    matchIndex++;
  }

  return result;
}

/**
 * Creates a comprehensive sanitizer that removes harmful content
 * Combines multiple sanitization strategies
 * @param input - The input string to sanitize
 * @param options - Sanitization options
 * @returns Sanitized string
 *
 * @example
 * ```typescript
 * const sanitized = createSanitizer({
 *   removeAnsi: true,
 *   removeControl: true,
 *   maxLength: 100
 * })("input");
 * ```
 */
export function createSanitizer(options: {
  removeAnsi?: boolean;
  removeControl?: boolean;
  maxLength?: number;
  trimWhitespace?: boolean;
}): (input: string) => string {
  const {
    removeAnsi = true,
    removeControl = true,
    maxLength = Infinity,
    trimWhitespace = false,
  } = options;

  return (input: string): string => {
    let result = typeof input === "string" ? input : String(input);

    if (trimWhitespace) {
      result = result.trim();
    }

    if (removeAnsi) {
      result = sanitizeAnsi(result);
    }

    if (removeControl) {
      result = sanitizeControl(result);
    }

    if (maxLength !== Infinity && Number.isFinite(maxLength)) {
      result = truncateVisibleWithAnsi(result, maxLength);
    }

    return result;
  };
}
