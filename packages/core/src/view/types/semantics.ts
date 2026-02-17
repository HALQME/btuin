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
