import type { LayoutElementShape, ComputedLayout as LayoutComputationResult, Rect } from "./layout";

export type { Rect };

export type Dimension = number | string | "auto";

export interface LayoutStyle {
  display?: "flex" | "none";
  position?: "relative" | "absolute";

  width?: Dimension;
  height?: Dimension;
  minWidth?: Dimension;
  minHeight?: Dimension;
  maxWidth?: Dimension;
  maxHeight?: Dimension;
  layoutBoundary?: boolean;

  padding?: number | [number, number, number, number];
  margin?: number | [number, number, number, number];

  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
  flexWrap?: "nowrap" | "wrap" | "wrap-reverse";
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: Dimension;

  justifyContent?:
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around"
    | "space-evenly";
  alignItems?: "flex-start" | "flex-end" | "center" | "baseline" | "stretch";
  alignSelf?: "auto" | "flex-start" | "flex-end" | "center" | "baseline" | "stretch";

  gap?: number | { width?: number; height?: number };
}

export interface LayoutInputNode extends LayoutElementShape, LayoutStyle {
  key?: string;
  identifier?: string;
  type: string;
  measuredSize?: { width: number; height: number };
  children?: LayoutInputNode[];
}

export type ComputedLayout = LayoutComputationResult;
