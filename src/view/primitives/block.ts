import { BaseView } from "../base";
import { markLayoutDirty } from "../dirty";
import type { BlockView, ViewElement } from "../types/elements";

export class BlockElement extends BaseView implements BlockView {
  type = "block" as const;
  children: ViewElement[];

  constructor() {
    super();
    // デフォルトは Flexbox の標準挙動
    this.style.display = "flex";
    this.children = new Proxy<ViewElement[]>([], {
      set(target, prop, value) {
        const prev = (target as any)[prop as any];
        if (prev === value) return true;
        (target as any)[prop as any] = value;
        // Children mutations affect both layout and rendering.
        // BaseView's style proxy marks dirty for style changes; this covers children changes.
        markLayoutDirty();
        return true;
      },
      deleteProperty(target, prop) {
        if (!Object.prototype.hasOwnProperty.call(target, prop)) return true;
        delete (target as any)[prop as any];
        markLayoutDirty();
        return true;
      },
    });
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
