import type { BaseElement, ViewElement } from "@btuin/types/elements";
import type { ElementModule } from "./element-module";
import { registerElementModule } from "./element-registry";

/**
 * Creates a ViewElement with the given type and properties.
 * This is a low-level function used internally by the framework.
 *
 * @template Type - The type string literal
 * @template Props - The properties object type
 * @param type - Element type identifier
 * @param props - Element properties including BaseElement fields
 * @returns A ViewElement with the specified type and properties
 *
 * @internal
 */
export function createModuleElement<Type extends string, Props extends Record<string, unknown>>(
  type: Type,
  props: Props & BaseElement,
): ViewElement {
  return { type, ...props } as ViewElement;
}

/**
 * Defines a new custom element type with associated behavior.
 * Returns a factory function that creates instances of the element.
 *
 * This is the primary way to create custom elements in btuin.
 *
 * @template T - The ViewElement type being defined
 * @param type - Unique string identifier for the element type
 * @param module - ElementModule with layout, render, and optional focus collection
 * @returns Factory function that creates element instances
 *
 * @example
 * ```typescript
 * interface ProgressBarElement extends BaseElement {
 *   type: "progressbar";
 *   value: number;
 * }
 *
 * const ProgressBar = defineElement<ProgressBarElement>("progressbar", {
 *   render(element, buf) {
 *     const rect = element.innerRect ?? element.rect;
 *     if (!rect) return;
 *     const filled = Math.floor((rect.width * element.value) / 100);
 *     const bar = "█".repeat(filled) + "░".repeat(rect.width - filled);
 *     drawText(buf, rect.y, rect.x, bar);
 *   },
 * });
 *
 * // Usage:
 * const element = ProgressBar({ value: 75, width: 40 });
 * ```
 */
export function defineElement<T extends ViewElement>(
  type: T["type"],
  module: ElementModule<T>,
): (props: Omit<T, "type">) => T {
  registerElementModule(type, module);
  return (props: Omit<T, "type">) => ({ type, ...props }) as T;
}
