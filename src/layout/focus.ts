import { ref } from "../reactivity";
import type { Ref } from "../reactivity/ref";
import type { ComputedLayout } from "../layout-engine/types";
import { isBlock, type ViewElement } from "../view/types/elements";
import type { FocusTarget } from "../view/types/focus";

class FocusManager {
  targets: FocusTarget[] = [];
  activeTarget: Ref<string | null> = ref(null);
  enabled = ref(false);

  setTargets(targets: FocusTarget[]) {
    this.targets = targets.sort((a, b) => {
      if (a.rect.y === b.rect.y) {
        return a.rect.x - b.rect.x;
      }
      return a.rect.y - b.rect.y;
    });

    if (this.targets.length > 0 && this.activeTarget.value === null) {
      this.activeTarget.value = this.targets[0]?.focusKey ?? null;
    }

    if (
      this.activeTarget.value &&
      !this.targets.some((t) => t.focusKey === this.activeTarget.value)
    ) {
      this.activeTarget.value = this.targets[0]?.focusKey ?? null;
    }
  }

  activate(key: string) {
    if (this.targets.some((t) => t.focusKey === key)) {
      this.activeTarget.value = key;
    }
  }

  next() {
    if (!this.enabled.value || this.targets.length === 0) return;
    const currentIndex = this.targets.findIndex((t) => t.focusKey === this.activeTarget.value);
    const nextIndex = (currentIndex + 1) % this.targets.length;
    this.activeTarget.value = this.targets[nextIndex]?.focusKey ?? null;
  }

  previous() {
    if (!this.enabled.value || this.targets.length === 0) return;
    const currentIndex = this.targets.findIndex((t) => t.focusKey === this.activeTarget.value);
    const nextIndex = (currentIndex - 1 + this.targets.length) % this.targets.length;
    this.activeTarget.value = this.targets[nextIndex]?.focusKey ?? null;
  }

  getActiveTarget(): FocusTarget | undefined {
    return this.targets.find((t) => t.focusKey === this.activeTarget.value);
  }
}

export const focusManager = new FocusManager();

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
    const childKey =
      child.identifier ?? (effectiveKey ? `${effectiveKey}/${child.type}-${i}` : undefined);
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
  effectiveKey: string | undefined = element.identifier,
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
  effectiveKey: string | undefined = element.identifier,
): Map<string, FocusTarget> {
  const map = new Map<string, FocusTarget>();
  visitFocusTargets(element, layoutMap, parentX, parentY, effectiveKey, (t) =>
    map.set(t.focusKey, t),
  );
  return map;
}
