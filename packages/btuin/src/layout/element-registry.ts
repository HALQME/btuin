import type { ViewElement } from "@btuin/types/elements";
import type { ElementModule } from "./element-module";

const elementModules = new Map<string, ElementModule>();

/**
 * Registers an element module for a given element type.
 * This allows the layout and rendering system to handle custom elements.
 *
 * @template T - The ViewElement type being registered
 * @param type - Unique string identifier for the element type
 * @param module - ElementModule containing layout, render, and focus logic
 *
 * @example
 * ```typescript
 * registerElementModule("custom", {
 *   render(element, buf, options) {
 *     // Custom rendering logic
 *   },
 * });
 * ```
 */
export function registerElementModule<T extends ViewElement>(
  type: string,
  module: ElementModule<T>,
) {
  elementModules.set(type, module as ElementModule);
}

/**
 * Retrieves a registered element module by type name.
 * Returns undefined if the type is not registered.
 *
 * @param type - Element type identifier
 * @returns The ElementModule for the given type, or undefined
 *
 * @internal
 */
export function getElementModule(type: string) {
  return elementModules.get(type);
}
