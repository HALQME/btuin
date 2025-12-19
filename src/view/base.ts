import type { KeyEventHook } from "./components/lifecycle";
import type { KeyEvent } from "../terminal";
import type { OutlineOptions } from "../renderer";
import type { Dimension, LayoutStyle } from "../layout-engine";

// 1. 基本的なプロパティ定義（スタイリング以外）
export interface ViewProps {
  /**
   * Stable identifier for layout, focus, diffing, etc.
   *
   * Historically this was called `key`; during refactors it was also exposed as
   * `identifier`. Both are supported for compatibility.
   */
  key?: string;
  identifier?: string;
  focusKey?: string;
  onFocus?: (e: KeyEvent) => void;
  // Taffy用のスタイル定義を含める
  style?: Partial<LayoutStyle> & {
    // Taffyにない独自の見た目プロパティもここに入れると管理しやすい
    foreground?: string | number;
    background?: string | number;
    outline?: OutlineOptions;
    stack?: "z";
  };
}

// 2. 基底クラス (Method Chainの核)
// 名前を ViewElement から BaseView に変更して衝突回避
export abstract class BaseView implements ViewProps {
  // 実際のデータ保持場所
  public style: NonNullable<ViewProps["style"]> = {};
  public key?: string;
  public identifier?: string;
  public focusKey?: string;
  public keyHooks: KeyEventHook[] = [];

  constructor(props: ViewProps = {}) {
    this.style = { ...props.style };
    const key = props.key ?? props.identifier;
    if (key) {
      this.key = key;
      this.identifier = key;
    }
    if (props.focusKey) this.focusKey = props.focusKey;
  }

  // --- レイアウト (Taffy直結) ---

  width(value: Dimension): this {
    this.style.width = value;
    return this;
  }

  height(value: Dimension): this {
    this.style.height = value;
    return this;
  }

  gap(value: number): this {
    // Taffyのgap定義に合わせる (number | { width, height })
    this.style.gap = value;
    return this;
  }

  padding(value: NonNullable<LayoutStyle["padding"]>): this {
    this.style.padding = value;
    return this;
  }

  grow(value = 1): this {
    this.style.flexGrow = value;
    return this;
  }

  shrink(value = 1): this {
    this.style.flexShrink = value;
    return this;
  }

  foreground(color: string | number): this {
    this.style.foreground = color;
    return this;
  }

  background(color: string | number): this {
    this.style.background = color;
    return this;
  }

  outline(options: OutlineOptions): this {
    this.style.outline = options;
    // Border occupies the outermost cells; default padding avoids children overlapping it.
    if (this.style.padding === undefined) {
      this.style.padding = 1;
    }
    return this;
  }

  focus(key: string): this {
    this.focusKey = key;
    return this;
  }

  setKey(value: string): this {
    this.key = value;
    this.identifier = value;
    return this;
  }

  setIdentifier(value: string): this {
    this.key = value;
    this.identifier = value;
    return this;
  }

  onKey(hook: KeyEventHook): this {
    this.keyHooks.push(hook);
    return this;
  }

  build(): this {
    return this;
  }
}
