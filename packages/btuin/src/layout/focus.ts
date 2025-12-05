import type { FocusTarget, ViewElement, LaidOutElement } from "@btuin/types/elements";
import type { KeyEvent } from "@btuin/types/key-event";
import { getElementModule } from "./element-registry";

export function collectFocusTargets(
  element: LaidOutElement,
  acc: FocusTarget[] = [],
): FocusTarget[] {
  if (element.focusKey) {
    acc.push({
      key: element.focusKey,
      rect: element.rect,
      title: element.outline?.title,
      element: element as ViewElement,
    });
  }

  const module = getElementModule(element.type);
  if (module?.collectFocus) {
    module.collectFocus(element, acc, {
      collectChild: (child) => collectFocusTargets(child as LaidOutElement, acc),
    });
  }
  return acc;
}

export function handleInternalElementKey(element: ViewElement, key: KeyEvent): boolean {
  const module = getElementModule(element.type);
  if (module?.handleKey) {
    return module.handleKey(element, key);
  }
  return false;
}
