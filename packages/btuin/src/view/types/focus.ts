import type { KeyEvent } from "@btuin/terminal";
import type { ViewElement } from "./elements";
import type { Rect } from "@btuin/layout-engine";

export interface FocusContext {
  focusables: FocusTarget[];
  focusedKey?: string;
  focusedElement?: ViewElement;
  focusNext: () => void;
  focusPrev: () => void;
  setFocus: (key: string) => void;
}

export type FocusHandler<State = unknown> = (
  state: State,
  key: KeyEvent,
  ctx: FocusContext,
) => State;

export interface FocusTarget {
  /** ユーザーが指定したフォーカス識別子 (例: "submit-btn") */
  focusKey: string;
  /** Taffyによって計算された絶対座標 */
  rect: Rect;
  /** 実際の要素参照 (フォーカス時にスタイルを変えたりイベントを送るため) */
  element: ViewElement;
  /** tabindex */
  order?: number;
}
