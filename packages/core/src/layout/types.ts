import type { ComputedLayout, LayoutInputNode } from "../layout-engine/types";

export interface LayoutEngine {
  computeLayout(
    root: LayoutInputNode,
    availableWidth?: number,
    availableHeight?: number,
  ): ComputedLayout;
}

export interface LayoutContainerSize {
  width: number;
  height: number;
}

export interface LayoutOptions {
  inline?: boolean;
}
