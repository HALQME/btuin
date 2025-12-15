import { Block, type BlockElement } from "./primitives";
import type { ViewElement } from "./types/elements";

// VStack は単に flex-direction: column な Block を作るだけ
export function VStack(children: ViewElement[] = []): BlockElement {
  return Block(...children).direction("column");
}

// HStack は flex-direction: row な Block
export function HStack(children: ViewElement[] = []): BlockElement {
  return Block(...children)
    .direction("row")
    .align("center");
}

// ZStack は子要素を同じ原点に重ねて描画するための Block
// レイアウトは通常通り計算しつつ、描画時に子のオフセットを揃える。
export function ZStack(children: ViewElement[] = []): BlockElement {
  const el = Block(...children);
  el.style.stack = "z";
  return el;
}

export function LayoutBoundary(children: ViewElement[] = []): BlockElement {
  return Block(...children).boundary();
}
