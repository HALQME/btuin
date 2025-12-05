import { defineElement } from "../layout/define-element";
import type { MultiChildElement, ViewElement } from "@btuin/types/elements";
import type { Rect } from "@btuin/types/geometry";
import { resolveDimension, resolveSizes } from "../layout/geometry";

/**
 * HStack element: arranges children horizontally.
 */
export interface HStackElement extends MultiChildElement {
  type: "hstack";
  gap?: number;
  children: ViewElement[];
}

/**
 * Type guard for HStack elements.
 */
export function isHStack(element: ViewElement): element is HStackElement {
  return element.type === "hstack";
}

/**
 * HStack Component
 *
 * Arranges child elements horizontally in a row (horizontal stack).
 * Children are laid out from left to right with optional gaps between them.
 *
 * @example
 * ```typescript
 * import { HStack } from "btuin";
 *
 * // Simple horizontal layout
 * HStack({
 *   children: [
 *     { type: "paragraph", text: "Left" },
 *     { type: "paragraph", text: "Center" },
 *     { type: "paragraph", text: "Right" },
 *   ]
 * })
 *
 * // With gap between children
 * HStack({
 *   gap: 2,
 *   children: [
 *     { type: "paragraph", text: "Item 1" },
 *     { type: "paragraph", text: "Item 2" },
 *   ]
 * })
 *
 * // With fixed widths
 * HStack({
 *   children: [
 *     { type: "paragraph", text: "Fixed", width: 10 },
 *     { type: "paragraph", text: "Auto-sized", width: "auto" },
 *   ]
 * })
 * ```
 *
 * @param props - HStackElement properties
 * @param props.children - Array of child elements to arrange horizontally
 * @param props.gap - Spacing between children (in characters)
 * @param props.width - Width of the stack container (number or "auto")
 * @param props.height - Height of the stack container (number or "auto")
 * @param props.focusKey - Optional focus key for keyboard navigation
 */
export const HStack = defineElement<HStackElement>("hstack", {
  layout(element, innerRect, helpers) {
    const gap = element.gap ?? 0;
    const widths = resolveSizes(element.children, innerRect.width, gap, "width");
    let x = innerRect.x;
    const children = element.children.map((child, index: number) => {
      const width = widths[index] ?? innerRect.width;
      const height = resolveDimension(child.height, innerRect.height);
      const childRect: Rect = {
        x,
        y: innerRect.y,
        width,
        height,
      };
      x += width + gap;
      return helpers.layoutChild(child, childRect);
    });
    return { ...element, children };
  },
  render(element, buf, options, helpers) {
    for (const child of element.children) helpers.renderChild(child);
  },
  collectFocus(element, acc, helpers) {
    for (const child of element.children) helpers.collectChild(child);
  },
});
