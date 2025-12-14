import type { ViewElement } from "../view/types/elements";
import type { ComputedLayout } from "@btuin/layout-engine";
import type { FocusTarget } from "../view/types/focus";
import { isBlock } from "../view/types/elements";

function visitFocusTargets(
  element: ViewElement,
  layoutMap: ComputedLayout,
  parentX: number,
  parentY: number,
  effectiveKey: string | undefined,
  visit: (target: FocusTarget) => void,
) {
  const layout = effectiveKey ? layoutMap[effectiveKey] : undefined;
  if (!layout) return;

  const absX = parentX + layout.x;
  const absY = parentY + layout.y;

  if (element.focusKey) {
    visit({
      focusKey: element.focusKey,
      element,
      rect: {
        x: absX,
        y: absY,
        width: layout.width,
        height: layout.height,
      },
    });
  }

  if (!isBlock(element)) return;

  for (let i = 0; i < element.children.length; i++) {
    const child = element.children[i]!;
    const childKey = child.key ?? (effectiveKey ? `${effectiveKey}/${child.type}-${i}` : undefined);
    visitFocusTargets(child, layoutMap, absX, absY, childKey, visit);
  }
}

/**
 * レイアウト計算済みの座標情報を使って、フォーカス可能な要素を収集する
 */
export function collectFocusTargets(
  element: ViewElement,
  layoutMap: ComputedLayout,
  parentX = 0,
  parentY = 0,
  effectiveKey: string | undefined = element.key,
): FocusTarget[] {
  const targets: FocusTarget[] = [];
  visitFocusTargets(element, layoutMap, parentX, parentY, effectiveKey, (t) => targets.push(t));

  return targets;
}

export function collectFocusTargetMap(
  element: ViewElement,
  layoutMap: ComputedLayout,
  parentX = 0,
  parentY = 0,
  effectiveKey: string | undefined = element.key,
): Map<string, FocusTarget> {
  const map = new Map<string, FocusTarget>();
  visitFocusTargets(element, layoutMap, parentX, parentY, effectiveKey, (t) =>
    map.set(t.focusKey, t),
  );
  return map;
}
