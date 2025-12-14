import type { ViewElement } from "../view/types/elements";
import type { ComputedLayout } from "@btuin/layout-engine";
import { type Buffer2D, drawText, fillRect } from "@btuin/renderer";

/**
 * 要素ツリーをバッファに描画する
 */
export function renderElement(
  element: ViewElement,
  buffer: Buffer2D,
  layoutMap: ComputedLayout,
  parentX = 0,
  parentY = 0,
) {
  // レイアウト計算結果を取得
  // キーがない場合は描画できない（あるいはルート要素などで特別扱いが必要なら調整）
  const key = element.key;
  if (!key) return;

  const layout = layoutMap[key];
  if (!layout) return;

  // 絶対座標を計算
  const absX = parentX + layout.x;
  const absY = parentY + layout.y;
  const width = layout.width;
  const height = layout.height;

  // 1. 背景色の描画
  if (element.backgroundColor !== undefined) {
    fillRect(
      buffer,
      Math.floor(absX),
      Math.floor(absY),
      Math.floor(width),
      Math.floor(height),
      " ",
      {
        bg: element.backgroundColor,
      },
    );
  }

  // 2. ボーダーの描画 (outlineプロパティがある場合)
  // ※ drawRect等が @btuin/renderer にある前提。なければ fillRect等で代用
  if (element.outline) {
    // 簡易的なボーダー描画
    // 上
    fillRect(buffer, absX, absY, width, 1, "─", { fg: element.outline.color });
    // 下
    fillRect(buffer, absX, absY + height - 1, width, 1, "─", { fg: element.outline.color });
    // 左
    fillRect(buffer, absX, absY, 1, height, "│", { fg: element.outline.color });
    // 右
    fillRect(buffer, absX + width - 1, absY, 1, height, "│", { fg: element.outline.color });

    // 四隅 (簡易)
    drawText(buffer, absY, absX, "┌", { fg: element.outline.color });
    drawText(buffer, absY, absX + width - 1, "┐", { fg: element.outline.color });
    drawText(buffer, absY + height - 1, absX, "└", { fg: element.outline.color });
    drawText(buffer, absY + height - 1, absX + width - 1, "┘", { fg: element.outline.color });
  }

  // 3. コンテンツの描画 (Paragraph等)
  if (element.type === "paragraph" && "text" in element) {
    // テキスト要素の描画 (パディング等は考慮せず、単純に配置)
    // 実際には折り返し処理などが必要
    const text = (element as any).text || "";
    const fg = element.foregroundColor;
    const bg = element.backgroundColor;

    // とりあえず1行描画
    drawText(buffer, Math.floor(absY), Math.floor(absX), text, { fg, bg });
  }

  // 4. 子要素の再帰描画
  if ("children" in element && Array.isArray(element.children)) {
    for (const child of element.children) {
      renderElement(child, buffer, layoutMap, absX, absY);
    }
  } else if ("child" in element && element.child) {
    renderElement(element.child, buffer, layoutMap, absX, absY);
  }
}
