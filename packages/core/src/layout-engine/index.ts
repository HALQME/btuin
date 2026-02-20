import type { LayoutInputNode, ComputedLayout } from "./types";

interface ChildInfo {
  node: LayoutInputNode;
  main: number;
  cross: number;
  flex: number;
}

/**
 * Estimate the intrinsic main-axis size of a node by recursively measuring
 * its children. Used when a block has no explicit size and no flex-grow.
 */
function estimateIntrinsicMain(
  node: LayoutInputNode,
  mainIsHeight: boolean,
): number {
  // 1. Explicit dimension
  const dim = mainIsHeight ? node.height : node.width;
  if (typeof dim === "number") return dim;

  // 2. Measured size (text nodes)
  const measured = (node as any).measuredSize;
  if (measured) return mainIsHeight ? measured.height : measured.width;

  // 3. No children → 0
  const children = node.children;
  if (!children || children.length === 0) return 0;

  // 4. Compute from children based on this node's flex direction
  const dir = node.flexDirection ?? "row";
  const isRow = dir === "row" || dir === "row-reverse";
  const nodeMainIsHeight = !isRow; // column → height, row → width

  // Resolve padding along the queried axis
  const paddingVal = (node as any).padding ?? 0;
  let padBefore: number;
  let padAfter: number;
  if (typeof paddingVal === "number") {
    padBefore = padAfter = paddingVal;
  } else if (Array.isArray(paddingVal) && paddingVal.length === 4) {
    if (mainIsHeight) {
      padBefore = paddingVal[0] ?? 0; // top
      padAfter = paddingVal[2] ?? 0;  // bottom
    } else {
      padBefore = paddingVal[3] ?? 0; // left
      padAfter = paddingVal[1] ?? 0;  // right
    }
  } else {
    padBefore = padAfter = 0;
  }

  // Gap along the node's OWN main axis (only relevant when axes match)
  const gapVal = (node as any).gap ?? 0;
  const gap = typeof gapVal === "number"
    ? gapVal
    : (nodeMainIsHeight ? (gapVal.height ?? 0) : (gapVal.width ?? 0));

  // Filter out absolute-positioned children
  const flowChildren = children.filter((c: any) => c.position !== "absolute");
  if (flowChildren.length === 0) return padBefore + padAfter;

  if (nodeMainIsHeight === mainIsHeight) {
    // Same axis: sum children sizes + gaps
    let total = 0;
    for (let i = 0; i < flowChildren.length; i++) {
      total += estimateIntrinsicMain(flowChildren[i]!, mainIsHeight);
      if (i < flowChildren.length - 1) total += gap;
    }
    return total + padBefore + padAfter;
  } else {
    // Cross axis: max of children sizes
    let max = 0;
    for (const child of flowChildren) {
      max = Math.max(max, estimateIntrinsicMain(child, mainIsHeight));
    }
    return max + padBefore + padAfter;
  }
}

export function computeLayout(
  root: LayoutInputNode,
  availableWidth = Infinity,
  availableHeight = Infinity,
): ComputedLayout {

  const computed: ComputedLayout = {};

  function resolveNode(
    node: LayoutInputNode,
    parentContentWidth?: number,
    parentContentHeight?: number,
    intrinsic = false,
  ): void {
    const paddingVal = (node as any).padding ?? 0;
    let padTop: number, padRight: number, padBottom: number, padLeft: number;

    if (typeof paddingVal === "number") {
      padTop = padRight = padBottom = padLeft = paddingVal;
    } else if (Array.isArray(paddingVal) && paddingVal.length === 4) {
      padTop = paddingVal[0] ?? 0;
      padRight = paddingVal[1] ?? 0;
      padBottom = paddingVal[2] ?? 0;
      padLeft = paddingVal[3] ?? 0;
    } else {
      padTop = padRight = padBottom = padLeft = 0;
    }

    const gapVal = (node as any).gap ?? 0;
    const gapMain =
      typeof gapVal === "number"
        ? gapVal
        : node.flexDirection?.startsWith("row")
          ? (gapVal.width ?? 0)
          : (gapVal.height ?? 0);

    const parentWidth = parentContentWidth ?? availableWidth;
    const parentHeight = parentContentHeight ?? availableHeight;

    // Resolve dimensions
    let width: number;
    let height: number;

    if (typeof node.width === "number") {
      width = node.width;
    } else if (typeof node.width === "string" && node.width.endsWith("%")) {
      width = (parseFloat(node.width) / 100) * parentWidth;
    } else if (node.width === "auto" || node.width === undefined) {
      width = intrinsic ? 0 : parentWidth;
    } else {
      width = parentWidth;
    }

    if (typeof node.height === "number") {
      height = node.height;
    } else if (typeof node.height === "string" && node.height.endsWith("%")) {
      height = (parseFloat(node.height) / 100) * parentHeight;
    } else if (node.height === "auto" || node.height === undefined) {
      height = intrinsic ? 0 : parentHeight;
    } else {
      height = parentHeight;
    }

    const contentWidth = Math.max(0, width - padLeft - padRight);
    const contentHeight = Math.max(0, height - padTop - padBottom);

    // Separate flow and absolute children
    const children = node.children ?? [];
    const flowChildren: LayoutInputNode[] = [];
    const absoluteChildren: LayoutInputNode[] = [];

    for (const child of children) {
      if ((child as any).position === "absolute") {
        absoluteChildren.push(child);
      } else {
        flowChildren.push(child);
      }
    }

    const mainDir = node.flexDirection ?? "row";
    const isRow = mainDir === "row" || mainDir === "row-reverse";

    // Process flow children - local childInfos for this node only
    const childInfos: ChildInfo[] = [];
    let totalFixedMain = 0;
    let totalFlex = 0;

    for (const c of flowChildren) {
      let mainSize: number | undefined;
      let crossSize: number | undefined;

      if (isRow) {
        if (typeof c.width === "number") {
          mainSize = c.width;
        } else if (typeof c.width === "string" && c.width.endsWith("%")) {
          mainSize = (parseFloat(c.width) / 100) * contentWidth;
        }
        if (typeof c.height === "number") {
          crossSize = c.height;
        } else if (typeof c.height === "string" && c.height.endsWith("%")) {
          crossSize = (parseFloat(c.height) / 100) * contentHeight;
        }
      } else {
        if (typeof c.height === "number") {
          mainSize = c.height;
        } else if (typeof c.height === "string" && c.height.endsWith("%")) {
          mainSize = (parseFloat(c.height) / 100) * contentHeight;
        }
        if (typeof c.width === "number") {
          crossSize = c.width;
        } else if (typeof c.width === "string" && c.width.endsWith("%")) {
          crossSize = (parseFloat(c.width) / 100) * contentWidth;
        }
      }

      const measured = (c as any).measuredSize;
      if (mainSize === undefined && measured) {
        mainSize = isRow ? measured.width : measured.height;
      }
      if (crossSize === undefined && measured) {
        crossSize = isRow ? measured.height : measured.width;
      }

      const flex = (c.flexGrow ?? 0) as number;

      if (intrinsic) {
        mainSize = mainSize ?? (measured ? (isRow ? measured.width : measured.height) : 0);
        crossSize = crossSize ?? (measured ? (isRow ? measured.height : measured.width) : 0);
        totalFixedMain += Math.max(0, mainSize ?? 0);
        childInfos.push({ node: c, main: mainSize ?? 0, cross: crossSize ?? 0, flex: 0 });
      } else {
        // Handle flexGrow
        if (flex > 0) {
          totalFlex += flex;
          mainSize = 0;
        } else if (typeof mainSize === "number") {
          totalFixedMain += Math.max(0, mainSize);
        } else {
          // Auto-size: compute intrinsic main-axis size from children
          mainSize = estimateIntrinsicMain(c, !isRow);
          totalFixedMain += Math.max(0, mainSize);
        }
        childInfos.push({ node: c, main: mainSize, cross: crossSize ?? 0, flex });
      }
    }

    const numFlowChildren = flowChildren.length;
    const totalGap = numFlowChildren > 1 ? (numFlowChildren - 1) * (gapMain ?? 0) : 0;
    const availableMain = intrinsic
      ? totalFixedMain
      : (isRow ? contentWidth : contentHeight) - totalGap - totalFixedMain;

    // Distribute flex space
    if (!intrinsic && totalFlex > 0 && availableMain > 0) {
      for (let i = 0; i < childInfos.length; i++) {
        const info = childInfos[i]!;
        if (info.flex > 0) {
          const allocated = Math.round((info.flex / totalFlex) * availableMain);
          info.main = Math.max(0, info.main + allocated);
        }
      }
    }

    // Calculate used main axis space
    let usedMain = totalGap;
    for (const info of childInfos) {
      usedMain += info.main;
    }

    // Calculate leading offset based on justifyContent
    let leadingOffset = 0;
    const justify = node.justifyContent ?? "flex-start";
    const containerMain = isRow ? contentWidth : contentHeight;
    const remainingSpace = containerMain - usedMain;

    if (justify === "center") {
      leadingOffset = Math.max(0, Math.floor(remainingSpace / 2));
    } else if (justify === "flex-end") {
      leadingOffset = Math.max(0, remainingSpace);
    }

    // Position children
    let cursor = leadingOffset;
    const alignItems = node.alignItems ?? "stretch";

    for (let i = 0; i < childInfos.length; i++) {
      const info = childInfos[i]!;
      const child = info.node;

      let crossSize = info.cross;

      // Resolve cross axis size
      if (crossSize === 0) {
        if (alignItems === "stretch") {
          crossSize = isRow ? contentHeight : contentWidth;
        } else {
          const childMeasured = (child as any).measuredSize;
          if (childMeasured) {
            crossSize = isRow ? childMeasured.height : childMeasured.width;
          } else if ((child as any).type === "block") {
            crossSize = isRow ? contentHeight : contentWidth;
          } else {
            crossSize = isRow ? contentHeight : contentWidth;
          }
        }
      }

      const main = info.main;

      // Calculate cross axis position
      let crossPos = 0;
      if (alignItems === "center") {
        crossPos = ((isRow ? contentHeight : contentWidth) - crossSize) / 2;
      } else if (alignItems === "flex-end") {
        crossPos = (isRow ? contentHeight : contentWidth) - crossSize;
      }

      const mainPos = cursor;
      const x = isRow ? padLeft + mainPos : padLeft + crossPos;
      const y = isRow ? padTop + crossPos : padTop + mainPos;

      const layoutId = (child as any).__layoutId;
      const key =
        layoutId !== undefined
          ? String(layoutId)
          : ((child as any).identifier ?? (child as any).key ?? `n${i}`);

      const rect = {
        x,
        y,
        width: isRow ? main : crossSize,
        height: isRow ? crossSize : main,
      };

      computed[key] = rect;

      cursor += main + (i < childInfos.length - 1 ? (gapMain ?? 0) : 0);

      // Update child's resolved dimensions
      (child as any).resolvedWidth = rect.width;
      (child as any).resolvedHeight = rect.height;

      // Recurse into children
      const childChildren = child.children;
      if (childChildren && childChildren.length > 0) {
        resolveNode(
          child,
          isRow ? rect.width : rect.width,
          isRow ? rect.height : rect.height,
        );
      }
    }

    // Process absolute children
    for (const child of absoluteChildren) {
      const childLayoutId = (child as any).__layoutId;
      const key =
        childLayoutId !== undefined
          ? String(childLayoutId)
          : ((child as any).identifier ?? (child as any).key ?? undefined);

      if (!key) continue;

      let w: number;
      let h: number;

      if (typeof child.width === "number") {
        w = child.width;
      } else if (typeof child.width === "string" && child.width.endsWith("%")) {
        w = (parseFloat(child.width) / 100) * contentWidth;
      } else {
        w = (child as any).measuredSize?.width ?? contentWidth;
      }

      if (typeof child.height === "number") {
        h = child.height;
      } else if (typeof child.height === "string" && child.height.endsWith("%")) {
        h = (parseFloat(child.height) / 100) * contentHeight;
      } else {
        h = (child as any).measuredSize?.height ?? contentHeight;
      }

      const rect = { x: padLeft, y: padTop, width: w, height: h };
      computed[key] = rect;

      const childChildren = child.children;
      if (childChildren && childChildren.length > 0) {
        resolveNode(child, rect.width, rect.height);
      }
    }

    // Store root layout
    const rootLayoutId = (node as any).__layoutId;
    const rootKey =
      rootLayoutId !== undefined
        ? String(rootLayoutId)
        : ((node as any).identifier ?? (node as any).key ?? "root");

    if (!computed[rootKey]) {
      computed[rootKey] = {
        x: 0,
        y: 0,
        width,
        height,
      };
    }
  }

  resolveNode(
    root,
    typeof root.width === "number" ? root.width : undefined,
    typeof root.height === "number" ? root.height : undefined,
  );


  return computed;
}

export const STYLE_STRIDE = 32;
export const RESULT_STRIDE = 5;
