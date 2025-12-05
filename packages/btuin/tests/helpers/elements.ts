import type { ViewElement } from "@btuin/types/elements";

/**
 * Generic type guard function for checking and narrowing element types.
 * Works with any element type that extends ViewElement.
 *
 * @example
 * if (isElementOfType<BoxElement>(element, "box")) {
 *   element.child; // TypeScript knows about child property
 * }
 */
export function isElementOfType<T extends ViewElement>(
  element: ViewElement,
  type: string,
): element is T {
  return element.type === type;
}

/**
 * Helper function to safely check if an element is of a specific type.
 * Uses the element's type property for runtime checking.
 *
 * @example
 * const isBox = isElementType(element, "box");
 */
export function isElementType(element: ViewElement, type: string): boolean {
  return element.type === type;
}
