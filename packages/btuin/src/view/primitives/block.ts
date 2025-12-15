import { BaseView } from "../base";
import type { BlockView, ViewElement } from "../types/elements";

export class BlockElement extends BaseView implements BlockView {
  type = "block" as const;
  children: ViewElement[] = [];

  constructor() {
    super();
    // デフォルトは Flexbox の標準挙動
    this.style.display = "flex";
  }

  // 子要素を追加するチェーンメソッド
  add(...children: ViewElement[]): this {
    this.children.push(...children);
    return this;
  }

  // Flexbox 関連のメソッドチェーン
  direction(dir: "row" | "column" | "row-reverse" | "column-reverse"): this {
    this.style.flexDirection = dir;
    return this;
  }

  justify(value: "flex-start" | "center" | "space-between" | "flex-end"): this {
    this.style.justifyContent = value;
    return this;
  }

  align(value: "flex-start" | "center" | "flex-end" | "stretch"): this {
    this.style.alignItems = value;
    return this;
  }

  boundary(): this {
    this.style.layoutBoundary = true;
    return this;
  }
}

// ファクトリ関数
export function Block(...children: ViewElement[]): BlockElement {
  return new BlockElement().add(...children);
}
