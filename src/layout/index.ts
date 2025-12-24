import { computeLayout as computeLayoutWasm } from "../layout-engine";
import type { ComputedLayout, Dimension, LayoutInputNode } from "../layout-engine/types";
import { measureTextWidth } from "../renderer/grapheme";
import { isBlock, isText, type BlockView, type ViewElement } from "../view/types/elements";
import type { LayoutContainerSize, LayoutEngine, LayoutOptions } from "./types";

export { renderElement } from "./renderer";

function ensureKeys(element: ViewElement, prefix: string) {
  if (!element.identifier && !element.key) {
    element.identifier = prefix;
    element.key = prefix;
  } else {
    const k = element.key ?? element.identifier;
    if (k) {
      element.key = k;
      element.identifier = k;
    }
  }

  if (isBlock(element)) {
    for (let i = 0; i < element.children.length; i++) {
      const child = element.children[i]!;
      ensureKeys(child, `${element.identifier}/${child.type}-${i}`);
    }
  }
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

function viewElementToLayoutNode(
  element: ViewElement,
  parentSize?: LayoutContainerSize,
  isRoot = false,
  options: LayoutOptions = {},
): LayoutInputNode {
  const { identifier, style } = element;

  const node: LayoutInputNode = {
    key: element.key ?? identifier,
    identifier,
    type: element.type,
    ...style,
  };

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
      node.children = childrenForLayout.map((child) => {
        const childNode = viewElementToLayoutNode(child, contentSize, false, options);
        if (childNode.position === undefined) childNode.position = "absolute";
        if (childNode.type === "block") {
          if (childNode.width === undefined && contentSize) {
            childNode.width = resolveDimension("100%", contentSize.width);
          }
          if (childNode.height === undefined && contentSize) {
            childNode.height = resolveDimension("100%", contentSize.height);
          }
        }
        return childNode;
      });
    } else {
      node.children = childrenForLayout.map((child) =>
        viewElementToLayoutNode(child, contentSize, false, options),
      );
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

  return node;
}

export function createLayout(engine: LayoutEngine = wasmLayoutEngine()) {
  return {
    layout: (
      root: ViewElement,
      containerSize?: LayoutContainerSize,
      options: LayoutOptions = {},
    ): ComputedLayout => {
      ensureKeys(root, "root");
      const layoutNode = viewElementToLayoutNode(root, containerSize, true, options);
      return engine.computeLayout(layoutNode);
    },
  };
}

function wasmLayoutEngine(): LayoutEngine {
  return {
    computeLayout: (root: LayoutInputNode) => computeLayoutWasm(root),
  };
}

export const { layout } = createLayout();
