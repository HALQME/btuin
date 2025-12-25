import type { KeyEventHook } from "../components/lifecycle";
import type { Dimension, LayoutStyle } from "../layout-engine/types";
import type { OutlineOptions } from "../renderer/types";
import type { KeyEvent } from "../terminal/types/key-event";
import { markHasScrollRegion, markLayoutDirty, markRenderDirty } from "./dirty";

const layoutStyleKeys = new Set<string>([
  "display",
  "position",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "layoutBoundary",
  "padding",
  "margin",
  "flexDirection",
  "flexWrap",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "justifyContent",
  "alignItems",
  "alignSelf",
  "gap",
  "stack",
]);

const renderStyleKeys = new Set<string>(["foreground", "background", "outline", "scrollRegion"]);

function createDirtyStyleProxy<T extends object>(style: T): T {
  return new Proxy(style, {
    set(target, prop, value) {
      if (typeof prop === "string") {
        // Avoid dirtying on idempotent writes.
        const prev = (target as any)[prop];
        if (prev === value) return true;
        (target as any)[prop] = value;

        if (layoutStyleKeys.has(prop)) {
          markLayoutDirty();
        } else if (renderStyleKeys.has(prop)) {
          if (prop === "scrollRegion" && value) markHasScrollRegion();
          markRenderDirty();
        } else {
          // Unknown style keys are treated as layout-affecting for safety.
          markLayoutDirty();
        }
        return true;
      }

      // Symbol keys: be conservative.
      (target as any)[prop as any] = value;
      markLayoutDirty();
      return true;
    },
    deleteProperty(target, prop) {
      if (typeof prop === "string") {
        if (!Object.prototype.hasOwnProperty.call(target, prop)) return true;
        delete (target as any)[prop];
        if (layoutStyleKeys.has(prop)) {
          markLayoutDirty();
        } else if (renderStyleKeys.has(prop)) {
          markRenderDirty();
        } else {
          markLayoutDirty();
        }
        return true;
      }
      delete (target as any)[prop as any];
      markLayoutDirty();
      return true;
    },
  });
}

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
    scrollRegion?: boolean;
  };
}

// 2. 基底クラス (Method Chainの核)
// 名前を ViewElement から BaseView に変更して衝突回避
export abstract class BaseView implements ViewProps {
  // 実際のデータ保持場所
  public style: NonNullable<ViewProps["style"]> = createDirtyStyleProxy({});
  public key?: string;
  public identifier?: string;
  public focusKey?: string;
  public keyHooks: KeyEventHook[] = [];

  constructor(props: ViewProps = {}) {
    this.style = createDirtyStyleProxy({ ...props.style });
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
    markLayoutDirty();
    return this;
  }

  setIdentifier(value: string): this {
    this.key = value;
    this.identifier = value;
    markLayoutDirty();
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
