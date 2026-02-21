import { computeLayout as computeLayoutJS } from "../layout-engine";
import type { ComputedLayout, Dimension, LayoutInputNode } from "../layout-engine/types";
import { measureTextWidth } from "../renderer/grapheme";
import { isBlock, isText, type BlockView, type ViewElement } from "../view/types/elements";
import { getDirtyVersions } from "../view/dirty";
import type { LayoutContainerSize, LayoutEngine, LayoutOptions } from "./types";

export { renderElement } from "./renderer";
export * from "./focus";

// Layout cache entry
interface LayoutCacheEntry {
  layoutVersion: number;
  sizeKey: string;
  result: ComputedLayout;
  timestamp: number;
}

// Global layout cache (single entry - keeps only latest)
let layoutCache: LayoutCacheEntry | null = null;

// Maximum cache age in ms (garbage collect old entries)
const MAX_CACHE_AGE_MS = 5000;

// Reset function for testing - DO NOT use in production
export function resetLayoutCache(): void {
  layoutCache = null;
}

function isPercent(value: unknown): value is string {
  return typeof value === "string" && /^\s*\d+(\.\d+)?%\s*$/.test(value);
}

function percentToNumber(value: string, base: number): number {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return base;
  return (base * n) / 100;
}

function resolvePadding(padding: unknown): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (typeof padding === "number") {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  if (Array.isArray(padding) && padding.length === 4) {
    const [top, right, bottom, left] = padding as number[];
    return {
      top: typeof top === "number" ? top : 0,
      right: typeof right === "number" ? right : 0,
      bottom: typeof bottom === "number" ? bottom : 0,
      left: typeof left === "number" ? left : 0,
    };
  }
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

function resolveDimension(dim: unknown, base: number): Dimension | undefined {
  if (!isPercent(dim)) return dim as Dimension | undefined;
  return percentToNumber(dim, base);
}

function estimateChildLength(
  child: ViewElement,
  direction: "row" | "column" | "row-reverse" | "column-reverse",
  parentSize?: LayoutContainerSize,
): number {
  const style = child.style ?? {};
  const base =
    direction === "column" || direction === "column-reverse"
      ? (parentSize?.height ?? 0)
      : (parentSize?.width ?? 0);
  const dimension =
    direction === "column" || direction === "column-reverse" ? style.height : style.width;
  const resolved = resolveDimension(dimension, base);
  if (typeof resolved === "number") {
    return Math.max(0, resolved);
  }
  const minDimension =
    direction === "column" || direction === "column-reverse" ? style.minHeight : style.minWidth;
  const resolvedMin = resolveDimension(minDimension, base);
  if (typeof resolvedMin === "number") {
    return Math.max(0, resolvedMin);
  }
  if (isText(child)) {
    return direction === "column" || direction === "column-reverse" ? 1 : child.content.length;
  }
  return 1;
}

function applyLayoutBoundaryToBlock(
  block: BlockView,
  children: ViewElement[],
  contentSize?: LayoutContainerSize,
  stack?: string,
): ViewElement[] {
  if (!block.style?.layoutBoundary || stack === "z" || !contentSize) {
    return children;
  }
  const direction = block.style.flexDirection ?? "column";
  const limit = direction === "column" ? contentSize.height : contentSize.width;
  if (typeof limit !== "number" || limit <= 0) {
    return children;
  }

  const filtered: ViewElement[] = [];
  let consumed = 0;

  for (const child of children) {
    const childLength = estimateChildLength(child, direction, contentSize);
    if (childLength > limit) {
      break;
    }
    if (consumed + childLength > limit) {
      break;
    }
    consumed += childLength;
    filtered.push(child);
    if (consumed >= limit) {
      break;
    }
  }

  return filtered;
}

// Reusable ID counter - reset per layout computation
let globalIdCounter = 0;

function convertViewTreeToLayout(
  element: ViewElement,
  parentSize?: LayoutContainerSize,
  isRoot = false,
  options: LayoutOptions = {},
  prefix = "",
  idToIdentifier = new Map<number, string>(),
): { node: LayoutInputNode; idToIdentifier: Map<number, string> } {
  // Assign identifier if missing (using prefix instead of expensive string concat)
  if (!element.identifier) {
    element.identifier = prefix || (isRoot ? "root" : "r");
  }
  if (!element.key) {
    element.key = element.identifier;
  }

  const { identifier, style } = element;
  const id = globalIdCounter++;

  // Store mapping for later result translation
  idToIdentifier.set(id, identifier);

  const node: LayoutInputNode = {
    key: element.key,
    identifier,
    type: element.type,
    ...style,
  };

  // Store ID for layout engine
  (node as any).__layoutId = id;

  if (isBlock(element)) {
    if (parentSize) {
      const baseWidth = parentSize.width;
      const baseHeight = parentSize.height;

      if (isRoot) {
        if (node.width === undefined || node.width === "100%") node.width = baseWidth;
        if (options.inline) {
          if (node.height === undefined || node.height === "100%") node.height = "auto";
        } else {
          if (node.height === undefined || node.height === "100%") node.height = baseHeight;
        }
      }

      if (node.width !== undefined) node.width = resolveDimension(node.width, baseWidth);
      if (node.height !== undefined) node.height = resolveDimension(node.height, baseHeight);
      if (node.minWidth !== undefined) node.minWidth = resolveDimension(node.minWidth, baseWidth);
      if (node.minHeight !== undefined)
        node.minHeight = resolveDimension(node.minHeight, baseHeight);
      if (node.maxWidth !== undefined) node.maxWidth = resolveDimension(node.maxWidth, baseWidth);
      if (node.maxHeight !== undefined)
        node.maxHeight = resolveDimension(node.maxHeight, baseHeight);
      if (node.flexBasis !== undefined)
        node.flexBasis = resolveDimension(node.flexBasis, baseWidth);
    }

    const pad = resolvePadding(node.padding);
    const contentSize =
      typeof node.width === "number" && typeof node.height === "number"
        ? {
            width: Math.max(0, node.width - pad.left - pad.right),
            height: Math.max(0, node.height - pad.top - pad.bottom),
          }
        : parentSize;

    const stack = element.style?.stack;
    const childrenForLayout = applyLayoutBoundaryToBlock(
      element,
      element.children,
      contentSize,
      stack,
    );

    if (stack === "z") {
      if (node.position === undefined) node.position = "relative";
      node.children = [];
      for (let i = 0; i < childrenForLayout.length; i++) {
        const child = childrenForLayout[i]!;
        const childResult = convertViewTreeToLayout(
          child,
          contentSize,
          false,
          options,
          `${identifier}/${child.type}-${i}`,
          idToIdentifier,
        );
        const childNode = childResult.node;
        if (childNode.position === undefined) childNode.position = "absolute";
        if (childNode.type === "block") {
          if (childNode.width === undefined && contentSize) {
            childNode.width = resolveDimension("100%", contentSize.width);
          }
          if (childNode.height === undefined && contentSize) {
            childNode.height = resolveDimension("100%", contentSize.height);
          }
        }
        node.children.push(childNode);
      }
    } else {
      node.children = [];
      for (let i = 0; i < childrenForLayout.length; i++) {
        const child = childrenForLayout[i]!;
        const childResult = convertViewTreeToLayout(
          child,
          contentSize,
          false,
          options,
          `${identifier}/${child.type}-${i}`,
          idToIdentifier,
        );
        node.children.push(childResult.node);
      }
    }
  } else if (isText(element)) {
    const textWidth = measureTextWidth(element.content);
    node.measuredSize = { width: textWidth, height: 1 };
    if (node.width === undefined) node.width = textWidth;
    if (node.height === undefined) node.height = 1;
  } else if (parentSize) {
    const baseWidth = parentSize.width;
    const baseHeight = parentSize.height;

    if (isRoot) {
      if (node.width === undefined || node.width === "100%") node.width = baseWidth;
      if (options.inline) {
        if (node.height === undefined || node.height === "100%") node.height = "auto";
      } else {
        if (node.height === undefined || node.height === "100%") node.height = baseHeight;
      }
    }

    if (node.width !== undefined) node.width = resolveDimension(node.width, baseWidth);
    if (node.height !== undefined) node.height = resolveDimension(node.height, baseHeight);
  }

  return { node, idToIdentifier };
}

export function createLayout(engine: LayoutEngine = jsLayoutEngine()) {
  return {
    layout: (
      root: ViewElement,
      containerSize?: LayoutContainerSize,
      options: LayoutOptions = {},
    ): ComputedLayout => {
      const { layout: currentLayoutVersion } = getDirtyVersions();
      const sizeKey = containerSize ? `${containerSize.width}x${containerSize.height}` : "auto";

      // Check cache first
      if (
        layoutCache &&
        layoutCache.layoutVersion === currentLayoutVersion &&
        layoutCache.sizeKey === sizeKey &&
        Date.now() - layoutCache.timestamp < MAX_CACHE_AGE_MS
      ) {
        return layoutCache.result;
      }

      // Reset global ID counter for this layout computation
      globalIdCounter = 0;

      // Single-pass conversion: builds layout nodes AND collects ID mappings
      const { node: layoutNode, idToIdentifier } = convertViewTreeToLayout(
        root,
        containerSize,
        true,
        options,
      );

      // Pass container size to layout engine
      const result = engine.computeLayout(layoutNode, containerSize?.width, containerSize?.height);

      // Map numeric IDs back to string identifiers
      const mappedResult: ComputedLayout = {};
      for (const [key, value] of Object.entries(result)) {
        const numericId = Number(key);
        const identifier = idToIdentifier.get(numericId);
        if (identifier) {
          mappedResult[identifier] = value;
        } else {
          mappedResult[key] = value;
        }
      }

      // Workaround: if root size is 0, use container size
      if (
        mappedResult["root"] &&
        mappedResult["root"].width === 0 &&
        mappedResult["root"].height === 0 &&
        containerSize
      ) {
        mappedResult["root"].width = containerSize.width;
        mappedResult["root"].height = containerSize.height;
      }

      // Update cache
      layoutCache = {
        layoutVersion: currentLayoutVersion,
        sizeKey,
        result: mappedResult,
        timestamp: Date.now(),
      };

      return mappedResult;
    },
  };
}

function jsLayoutEngine(): LayoutEngine {
  return {
    computeLayout: (root: LayoutInputNode, availableWidth?: number, availableHeight?: number) =>
      computeLayoutJS(root, availableWidth, availableHeight),
  };
}

export const { layout } = createLayout();
