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
