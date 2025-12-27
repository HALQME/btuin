import type { BaseView } from "../base";

export interface Semantics {
  role?:
    | "button"
    | "checkbox"
    | "radio"
    | "textbox"
    | "search"
    | "tab"
    | "tabpanel"
    | "list"
    | "listitem"
    | "progressbar"
    | "scrollbar"
    | "slider"
    | "spinbutton"
    | "switch"
    | "alert"
    | "alertdialog"
    | "dialog"
    | "menu"
    | "menubar"
    | "menuitem"
    | "menuitemcheckbox"
    | "menuitemradio"
    | "tooltip"
    | "tree"
    | "treeitem"
    | "treegrid"
    | "grid"
    | "gridcell"
    | "heading"
    | "link"
    | "status"
    | "timer"
    | "log"
    | "marquee"
    | "math";
  label?: string;
  description?: string;

  // ARIA-like states
  disabled?: boolean;
  checked?: boolean | "mixed";
  expanded?: boolean;
  selected?: boolean;
  pressed?: boolean;
  level?: number;
  valueMin?: number;
  valueMax?: number;
  valueNow?: number;
  valueText?: string;
}

export interface BlockView extends BaseView {
  type: "block";
  children: ViewElement[];
}

export interface TextView extends BaseView {
  type: "text";
  content: string;
}

export interface InputView extends BaseView {
  type: "input";
  value: string;
}

export type ViewElement = BlockView | TextView | InputView;

export function isBlock(element: ViewElement): element is BlockView {
  return element.type === "block";
}

export function isText(element: ViewElement): element is TextView {
  return element.type === "text";
}
