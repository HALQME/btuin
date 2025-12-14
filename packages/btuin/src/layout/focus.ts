import type { ViewElement } from "../view/types/elements";
import type { ComputedLayout } from "@btuin/layout-engine";
import type { FocusTarget } from "../view/types/focus";
import { isBlock } from "../view/types/elements";

/**
 * レイアウト計算済みの座標情報を使って、フォーカス可能な要素を収集する
 */
export function collectFocusTargets(
  element: ViewElement,
  layoutMap: ComputedLayout,
  parentX = 0,
  parentY = 0,
): FocusTarget[] {
  const targets: FocusTarget[] = [];

  // この要素のレイアウト結果を取得
  // (要素には一意な key が割り当てられている前提)
  const layout = element.key ? layoutMap[element.key] : undefined;

  // レイアウト情報がない場合は描画されないのでフォーカスも不可
  if (!layout) return [];

  const absX = parentX + layout.x;
  const absY = parentY + layout.y;

  // focusKey を持っていればターゲットとして登録
  if (element.focusKey) {
    targets.push({
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

  // 子要素があれば再帰的に探索 (BlockViewの場合)
  if (isBlock(element)) {
    for (const child of element.children) {
      targets.push(...collectFocusTargets(child, layoutMap, absX, absY));
    }
  }

  return targets;
}
