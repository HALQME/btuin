import { defineElement } from "../layout/define-element";
import type { MultiChildElement, ViewElement } from "@btuin/types/elements";

/**
 * ZStack element: arranges children in a stack (z-order).
 */
export interface ZStackElement extends MultiChildElement {
  type: "zstack";
  gap?: number;
  children: ViewElement[];
}

/**
 * Type guard for ZStack elements.
 */
export function isZStack(element: ViewElement): element is ZStackElement {
  return element.type === "zstack";
}

/**
 * ZStack Component
 *
 * Stacks child elements on top of each other along the z-axis (layering/overlay).
 * All children are laid out in the same rectangular area, with later children
 * rendered on top of earlier ones.
 *
 * Useful for creating overlays, backgrounds, or layered UI elements.
 *
 * @example
 * ```typescript
 * import { ZStack } from "btuin";
 *
 * // Simple overlay
 * ZStack({
 *   children: [
 *     { type: "paragraph", text: "Background", color: "gray" },
 *     { type: "paragraph", text: "Foreground", color: "cyan" },
 *   ]
 * })
 *
 * // Background with centered content
 * ZStack({
 *   children: [
 *     { type: "box", border: "single", child: { type: "paragraph", text: "" } },
 *     { type: "paragraph", text: "Centered Text", align: "center" },
 *   ]
 * })
 *
 * // Multiple layers
 * ZStack({
 *   width: 30,
 *   height: 10,
 *   children: [
 *     { type: "paragraph", text: "Layer 1 (bottom)" },
 *     { type: "paragraph", text: "Layer 2 (middle)" },
 *     { type: "paragraph", text: "Layer 3 (top)" },
 *   ]
 * })
 * ```
 *
 * @param props - ZStackElement properties
 * @param props.children - Array of child elements to stack (first = bottom, last = top)
 * @param props.width - Width of the stack container (number or "auto")
 * @param props.height - Height of the stack container (number or "auto")
 * @param props.focusKey - Optional focus key for keyboard navigation
 */
export const ZStack = defineElement<ZStackElement>("zstack", {
  layout(element, innerRect, helpers) {
    // All children share the same rect (overlay positioning)
    const children = element.children.map((child) => helpers.layoutChild(child, innerRect));
    return { ...element, children };
  },
  render(element, buf, options, helpers) {
    // Render in order: first child is bottom layer, last child is top layer
    for (const child of element.children) {
      helpers.renderChild(child);
    }
  },
  collectFocus(element, acc, helpers) {
    // Collect focus from all children
    for (const child of element.children) {
      helpers.collectChild(child);
    }
  },
});
