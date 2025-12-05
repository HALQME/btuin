import type { ViewElement, LaidOutElement } from "@btuin/types/elements";
import type { Rect } from "@btuin/types/geometry";
import { getElementModule } from "./element-registry";
import { resolveContentRect } from "./geometry";

export function layout(element: ViewElement, rect: Rect): LaidOutElement {
  const innerRect = resolveContentRect(element, rect);
  const prepared: ViewElement = { ...element, rect, innerRect };
  const module = getElementModule(element.type);

  if (module?.layout) {
    const result = module.layout(prepared, innerRect, {
      layoutChild: (child: ViewElement, childRect: Rect) => layout(child, childRect),
    }) as LaidOutElement;
    return result;
  }

  if (module) {
    return { ...prepared, rect } as LaidOutElement;
  }

  throw new Error(`Unknown element type "${element.type}" – register a module before layout.`);
}
