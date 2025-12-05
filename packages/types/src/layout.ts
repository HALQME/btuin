import type { ViewElement } from "./elements";
import type { Rect } from "./geometry";

export type LayoutChildFn = (child: ViewElement, rect: Rect) => ViewElement;
