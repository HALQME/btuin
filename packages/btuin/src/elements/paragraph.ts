import { drawText, type Buffer2D } from "../buffer";
import { defineElement } from "../layout/define-element";
import type { LeafElement } from "@btuin/types/elements";
import type { ColorValue } from "@btuin/types/color";

/**
 * Paragraph element: displays text with optional wrapping, alignment, and color.
 */
export interface ParagraphElement extends LeafElement {
  type: "paragraph";
  text: string;
  wrap?: boolean;
  align?: "left" | "center" | "right";
  color?: ColorValue;
}

/**
 * Type guard for Paragraph elements.
 */
export function isParagraph(element: any): element is ParagraphElement {
  return element.type === "paragraph";
}

/**
 * Paragraph Component
 *
 * Displays text content with optional wrapping, alignment, and color.
 * Automatically handles line breaks and text truncation based on available space.
 *
 * @example
 * ```typescript
 * import { Paragraph } from "btuin";
 *
 * // Simple text display
 * Paragraph({
 *   text: "Hello, World!"
 * })
 *
 * // With color and alignment
 * Paragraph({
 *   text: "Centered text",
 *   align: "center",
 *   color: "cyan"
 * })
 *
 * // With text wrapping disabled
 * Paragraph({
 *   text: "This is a very long line that will be truncated instead of wrapped",
 *   wrap: false
 * })
 *
 * // Multi-line text
 * Paragraph({
 *   text: "Line 1\nLine 2\nLine 3",
 *   width: 20,
 *   height: 5
 * })
 * ```
 *
 * @param props - ParagraphElement properties
 * @param props.text - The text content to display
 * @param props.color - Text color (e.g., "cyan", "red", "gray")
 * @param props.align - Text alignment: "left", "center", or "right" (default: "left")
 * @param props.wrap - Whether to wrap long lines (default: true)
 * @param props.width - Width of the paragraph container (number or "auto")
 * @param props.height - Height of the paragraph container (number or "auto")
 * @param props.focusKey - Optional focus key for keyboard navigation
 */
export const Paragraph = defineElement<ParagraphElement>("paragraph", {
  render(element, buf) {
    renderParagraph(element, buf);
  },
});

function renderParagraph(element: ParagraphElement, buf: Buffer2D) {
  const rect = element.innerRect ?? element.rect;
  if (!rect || rect.width <= 0 || rect.height <= 0) return;
  const wrapped =
    element.wrap === false
      ? splitLines(element.text)
      : wrapLines(element.text, Math.max(1, rect.width));
  const style = element.color !== undefined ? { fg: element.color } : undefined;

  for (let i = 0; i < rect.height; i++) {
    const line = wrapped[i] ?? "";
    const truncated = line.slice(0, rect.width);
    const padded = alignText(truncated, rect.width, element.align ?? "left");
    drawText(buf, rect.y + i, rect.x, padded.padEnd(rect.width, " "), style);
  }
}

function splitLines(text: string): string[] {
  return text.split("\n");
}

function wrapLines(text: string, width: number): string[] {
  if (width <= 0) return [];

  // First split by explicit newlines
  const explicitLines = text.split("\n");
  const allLines: string[] = [];

  // Wrap each line individually
  for (const line of explicitLines) {
    const wrappedLine = wrapSingleLine(line, width);
    allLines.push(...wrappedLine);
  }

  return allLines.length > 0 ? allLines : [""];
}

function wrapSingleLine(text: string, width: number): string[] {
  if (width <= 0) return [""];
  if (!text) return [""];

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if ((current + word).length <= width) {
      current += (current ? " " : "") + word;
    } else {
      if (current) lines.push(current);
      if (word.length > width) {
        for (let i = 0; i < word.length; i += width) {
          lines.push(word.slice(i, i + width));
        }
        current = "";
      } else {
        current = word;
      }
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function alignText(text: string, width: number, align: "left" | "center" | "right") {
  if (text.length >= width) return text.slice(0, width);
  const padding = width - text.length;
  switch (align) {
    case "center": {
      const left = Math.floor(padding / 2);
      const right = padding - left;
      return " ".repeat(left) + text + " ".repeat(right);
    }
    case "right":
      return " ".repeat(padding) + text;
    default:
      return text + " ".repeat(padding);
  }
}
