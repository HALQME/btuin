import { defineElement } from "../layout/define-element";
import type { MultiChildElement, ViewElement } from "@btuin/types/elements";
import type { Rect } from "@btuin/types/geometry";
import { resolveDimension, resolveSizes } from "../layout/geometry";

/**
 * VStack element: arranges children vertically.
 */
export interface VStackElement extends MultiChildElement {
  type: "vstack";
  gap?: number;
  children: ViewElement[];
}

/**
 * Type guard for VStack elements.
 */
export function isVStack(element: ViewElement): element is VStackElement {
  return element.type === "vstack";
}

/**
 * VStack Component
 *
 * Arranges child elements vertically in a column (vertical stack).
 * Children are laid out from top to bottom with optional gaps between them.
 *
 * @example
 * ```typescript
 * import { VStack } from "btuin";
 *
 * // Simple vertical layout
 * VStack({
 *   children: [
 *     { type: "paragraph", text: "Top" },
 *     { type: "paragraph", text: "Middle" },
 *     { type: "paragraph", text: "Bottom" },
 *   ]
 * })
 *
 * // With gap between children
 * VStack({
 *   gap: 1,
 *   children: [
 *     { type: "paragraph", text: "Item 1" },
 *     { type: "paragraph", text: "Item 2" },
 *   ]
 * })
 *
 * // With fixed heights
 * VStack({
 *   children: [
 *     { type: "paragraph", text: "Fixed", height: 3 },
 *     { type: "paragraph", text: "Auto-sized", height: "auto" },
 *   ]
 * })
 * ```
 *
 * @param props - VStackElement properties
 * @param props.children - Array of child elements to arrange vertically
 * @param props.gap - Spacing between children (in lines)
 * @param props.width - Width of the stack container (number or "auto")
 * @param props.height - Height of the stack container (number or "auto")
 * @param props.focusKey - Optional focus key for keyboard navigation
 */
export const VStack = defineElement<VStackElement>("vstack", {
  layout(element, innerRect, helpers) {
    const gap = element.gap ?? 0;
    const heights = resolveSizes(element.children, innerRect.height, gap, "height");
    let y = innerRect.y;
    const children = element.children.map((child, index: number) => {
      const height = heights[index] ?? innerRect.height;
      const width = resolveDimension(child.width, innerRect.width);
      const childRect: Rect = {
        x: innerRect.x,
        y,
        width,
        height,
      };
      y += height + gap;
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
