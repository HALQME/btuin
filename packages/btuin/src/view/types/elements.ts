import type { KeyEvent } from "@btuin/terminal";
import type { OutlineOptions } from "@btuin/renderer";
import type { Rect, SizeValue } from "@btuin/layout-engine";

export interface FocusContext {
  focusables: FocusTarget[];
  focusedKey?: string;
  focusedElement?: ViewElement;
  focusNext: () => void;
  focusPrev: () => void;
  setFocus: (key: string) => void;
}

export type FocusHandler<State = unknown> = (
  state: State,
  key: KeyEvent,
  ctx: FocusContext,
) => State;

export interface FocusTarget {
  key: string;
  rect: Rect;
  title?: string;
  element: ViewElement;
}

export interface BaseElement {
  width?: SizeValue;
  height?: SizeValue;

  outline?: OutlineOptions;

  focusKey?: string;
  onFocusKey?: FocusHandler<any>;
}

/**
 * LeafElement: Elements that do not contain children.
 * Examples: Paragraph, TextInput, Console
 */
export interface LeafElement extends BaseElement {
  type: string;
  // Explicitly no children property
}

/**
 * SingleChildElement: Elements that contain a single child element.
 * Examples: Box
 */
export interface SingleChildElement extends BaseElement {
  type: string;
  child?: ViewElement;
}

/**
 * MultiChildElement: Elements that contain multiple child elements.
 * Examples: VStack, HStack, ZStack
 */
export interface MultiChildElement extends BaseElement {
  type: string;
  children: ViewElement[];
}

/**
 * ViewElement: Unified interface for all UI elements.
 * Each concrete element type extends one of: LeafElement, SingleChildElement, or MultiChildElement.
 * This enables type-safe handling of children without `as any` casts.
 *
 * Concrete implementations are defined in their respective modules and extend
 * the appropriate base type (Leaf, SingleChild, or MultiChild).
 */
export type ViewElement = LeafElement | SingleChildElement | MultiChildElement;

/**
 * LaidOutElement: Result of layout() computation.
 * Combines a ViewElement with its calculated rect and resolved children.
 * Used to distinguish between pre-layout and post-layout elements in the type system.
 *
 * All elements have a rect after layout.
 * Leaf elements never have children.
 * Single-child elements may have a child (optional).
 * Multi-child elements always have children array.
 */
export type LaidOutElement =
  | (LeafElement & { rect: Rect })
  | (SingleChildElement & { rect: Rect })
  | (MultiChildElement & { rect: Rect });

/**
 * LaidOutConsoleElement: Console element after layout.
 * Console dynamically generates children during layout based on captured output.
 * This type represents a Console element with its generated children.
 */
export type LaidOutConsoleElement = LeafElement & {
  type: "console";
  rect: Rect;
  children: ViewElement[];
};

/**
 * Generic type guard helper for checking element type.
 * Usage: if (isElementType(element, "your-type")) { }
 */
export function isElementType<T extends ViewElement = ViewElement>(
  element: ViewElement,
  type: string,
): element is T {
  return element.type === type;
}

/**
 * Type guard to check if an element is a LeafElement.
 * Leaf elements do not contain children.
 */
export function isLeafElement(element: any): element is LeafElement {
  return typeof element.children === "undefined" && typeof element.child === "undefined";
}

/**
 * Type guard to check if an element is a SingleChildElement.
 * Single-child elements contain an optional child element.
 */
export function isSingleChildElement(element: any): element is SingleChildElement {
  return (
    typeof element.child !== "undefined" ||
    (typeof element.children === "undefined" &&
      element.type !== "paragraph" &&
      element.type !== "input" &&
      element.type !== "console")
  );
}

/**
 * Type guard to check if an element is a MultiChildElement.
 * Multi-child elements contain a children array.
 */
export function isMultiChildElement(element: any): element is MultiChildElement {
  return Array.isArray(element.children);
}

/**
 * Type guard to check if an element is a Console element with generated children.
 * Console elements generate children during layout, so this guard is useful
 * in render and collectFocus phases where children are guaranteed to exist.
 */
export function isConsoleWithChildren(element: any): element is LaidOutConsoleElement {
  return element.type === "console" && Array.isArray(element.children);
}
