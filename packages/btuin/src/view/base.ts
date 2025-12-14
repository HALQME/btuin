import type { KeyEvent } from "@btuin/terminal";
import type { OutlineOptions } from "@btuin/renderer";
import type { Dimension, LayoutStyle } from "@btuin/layout-engine";

// 1. 基本的なプロパティ定義（スタイリング以外）
export interface ViewProps {
  key?: string;
  focusKey?: string;
  onFocus?: (e: KeyEvent) => void;
  // Taffy用のスタイル定義を含める
  style?: Partial<LayoutStyle> & {
    // Taffyにない独自の見た目プロパティもここに入れると管理しやすい
    foreground?: string | number;
    background?: string | number;
    outline?: OutlineOptions;
  };
}

// 2. 基底クラス (Method Chainの核)
// 名前を ViewElement から BaseView に変更して衝突回避
export abstract class BaseView implements ViewProps {
  // 実際のデータ保持場所
  public style: NonNullable<ViewProps["style"]> = {};
  public key?: string;
  public focusKey?: string;

  constructor(props: ViewProps = {}) {
    this.style = { ...props.style };
    if (props.key) this.key = props.key;
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

  // --- 見た目 (Renderer用) ---

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
    return this;
  }

  // --- システム ---

  focus(key: string): this {
    this.focusKey = key;
    return this;
  }

  setKey(value: string): this {
    this.key = value;
    return this;
  }

  build(): this {
    return this;
  }
}
