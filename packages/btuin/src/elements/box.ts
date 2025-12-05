import { defineElement } from "../layout/define-element";
import type { SingleChildElement, ViewElement } from "@btuin/types/elements";

/**
 * Box element: wraps a single child with optional styling.
 */
export interface BoxElement extends SingleChildElement {
  type: "box";
  child?: ViewElement;
}

/**
 * Type guard for Box elements.
 */
export function isBox(element: ViewElement): element is BoxElement {
  return element.type === "box";
}

/**
 * Box Component
 *
 * A basic container that wraps a single child element.
 * Primarily used to apply padding, borders, or other styling to its child.
 *
 * @example
 * ```typescript
 * import { Box } from "btuin";
 *
 * // Simple box with child
 * Box({
 *   child: { type: "paragraph", text: "Hello World" }
 * })
 *
 * // Box with border
 * Box({
 *   outline: { title: "Boxed" },
 *   child: { type: "paragraph", text: "Bordered content" }
 * })
 *
 * // Box with custom dimensions
 * Box({
 *   width: 20,
 *   height: 5,
 *   child: { type: "paragraph", text: "Fixed size" }
 * })
 * ```
 *
 * @param props - Box properties
 * @param props.child - The child element to wrap
 * @param props.width - Width of the box (number or "auto")
 * @param props.height - Height of the box (number or "auto")
 * @param props.outline - Outline/border styling options
 * @param props.focusKey - Optional focus key for keyboard navigation
 */
export const Box = defineElement<BoxElement>("box", {
  layout(element, innerRect, helpers) {
    if (!element.child) return element;
    const child = helpers.layoutChild(element.child, innerRect);
    return { ...element, child };
  },

  render(element, buf, options, helpers) {
    if (element.child) helpers.renderChild(element.child);
  },

  collectFocus(element, acc, helpers) {
    if (element.child) helpers.collectChild(element.child);
  },
});
