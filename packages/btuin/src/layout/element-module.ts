import type { Buffer2D } from "../buffer";
import type { KeyEvent } from "@btuin/types/key-event";
import type { FocusTarget, ViewElement } from "@btuin/types/elements";
import type { LayoutChildFn } from "@btuin/types/layout";
import type { Rect } from "@btuin/types/geometry";

export interface ElementModule<T extends ViewElement = ViewElement> {
  layout?: (
    element: T,
    innerRect: Rect,
    helpers: {
      layoutChild: LayoutChildFn;
    },
  ) => ViewElement;
  render?: (
    element: T,
    buf: Buffer2D,
    options: { activeFocusKey?: string },
    helpers: { renderChild: (child: ViewElement) => void },
  ) => void;
  collectFocus?: (
    element: T,
    acc: FocusTarget[],
    helpers: { collectChild: (child: ViewElement) => void },
  ) => void;
  handleKey?: (element: T, key: KeyEvent) => boolean;
}
