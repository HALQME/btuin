import type { Rect } from "./geometry";
export type { Rect };

export interface LayoutElementShape {
  type: string;
  children?: LayoutElementShape[];
  rect?: Rect;
}

export type LayoutChildFn = (child: LayoutElementShape, rect: Rect) => LayoutElementShape;

export interface LayoutResult {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface ComputedLayout {
  [key: string]: LayoutResult;
}
