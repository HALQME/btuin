/**
 * Console Component
 *
 * Displays captured stdout/stderr output within the TUI.
 * Automatically scrolls to show the latest output when new lines arrive.
 *
 * @example
 * ```typescript
 * import { Console } from "btuin";
 *
 * Console({
 *   maxLines: 10,
 *   title: "Output",
 * })
 * ```
 */

import type { LeafElement, ViewElement } from "@btuin/types/elements";
import { isConsoleWithChildren } from "@btuin/types/elements";
import type { Rect } from "@btuin/types/geometry";
import { defineElement } from "../layout/define-element";
import { resolveDimension } from "../layout/geometry";
import { getConsoleCaptureInstance } from "../terminal/console-capture";
import type { ParagraphElement } from "./paragraph";

/**
 * Console element: displays captured stdout/stderr output.
 * Extends LeafElement because children are generated at layout time, not at creation time.
 */
export interface ConsoleElement extends LeafElement {
  type: "console";
  maxLines?: number;
  showStdout?: boolean;
  showStderr?: boolean;
  title?: string;
}

/**
 * Type guard for Console elements.
 */
export function isConsole(element: ViewElement): element is ConsoleElement {
  return element.type === "console";
}

export interface ConsoleProps {
  /**
   * Maximum number of lines to display.
   * @default 20
   */
  maxLines?: number;

  /**
   * Whether to show stdout output.
   * @default true
   */
  showStdout?: boolean;

  /**
   * Whether to show stderr output.
   * @default true
   */
  showStderr?: boolean;

  /**
   * Title to display above console output.
   */
  title?: string;

  /**
   * Width of the console container.
   */
  width?: number | "auto";

  /**
   * Height of the console container.
   */
  height?: number | "auto";
}

// Internal scroll state: tracks offset and line count to detect new output
interface ScrollState {
  offset: number;
  lastLineCount: number;
}

const scrollStateMap = new WeakMap<ConsoleElement, ScrollState>();

/**
 * Create a Console element to display captured stdout/stderr output.
 * Automatically scrolls to show the latest output when new lines are added.
 *
 * @param props - Console configuration options
 * @returns ConsoleElement representing the console
 */
export const Console = defineElement<ConsoleElement>("console", {
  layout(element, innerRect, helpers) {
    const { maxLines = 20, showStdout = true, showStderr = true, title } = element;

    // Get singleton capture instance
    const capture = getConsoleCaptureInstance({ maxLines: 1000 });

    // Get current lines
    let lines = capture.getLines();

    // Filter by type
    if (!showStdout) {
      lines = lines.filter((l) => l.type !== "stdout");
    }
    if (!showStderr) {
      lines = lines.filter((l) => l.type !== "stderr");
    }

    // Manage scroll offset: auto-scroll when new output arrives
    let state = scrollStateMap.get(element) ?? { offset: 0, lastLineCount: 0 };

    // Detect new output and scroll to show it
    if (lines.length > state.lastLineCount) {
      // New output arrived, scroll down to show the latest
      state.offset = Math.max(0, lines.length - maxLines);
    }

    // Update state for next frame
    state.lastLineCount = lines.length;
    scrollStateMap.set(element, state);

    // Calculate visible window
    const maxOffset = Math.max(0, lines.length - maxLines);
    const startLine = Math.min(state.offset, maxOffset);
    const endLine = startLine + maxLines;
    const visible = lines.slice(startLine, endLine);

    // Build children array
    const children: ViewElement[] = [];

    if (title) {
      children.push({
        type: "paragraph",
        text: title,
        color: "cyan",
      } as ParagraphElement);
    }

    // Convert visible lines to paragraphs
    if (visible.length > 0) {
      for (const line of visible) {
        children.push({
          type: "paragraph",
          text: line.text,
          color: line.type === "stderr" ? "red" : undefined,
        } as ParagraphElement);
      }
    } else {
      // Show placeholder if no output
      children.push({
        type: "paragraph",
        text: "(no console output)",
        color: "gray",
      } as ParagraphElement);
    }

    // Layout children
    let y = innerRect.y;
    const layoutChildren: ViewElement[] = [];

    for (const child of children) {
      const width = resolveDimension(child.width, innerRect.width);
      const childRect: Rect = {
        x: innerRect.x,
        y,
        width,
        height: 1, // Each paragraph is 1 line
      };
      layoutChildren.push(helpers.layoutChild(child, childRect));
      y += 1;
    }

    return { ...element, children: layoutChildren };
  },

  render(element, buf, options, helpers) {
    if (isConsoleWithChildren(element)) {
      for (const child of element.children) {
        helpers.renderChild(child);
      }
    }
  },

  collectFocus(element, acc, helpers) {
    if (isConsoleWithChildren(element)) {
      for (const child of element.children) {
        helpers.collectChild(child);
      }
    }
  },
});
