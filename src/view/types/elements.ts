import type { BaseView } from "../base";

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
