import { BaseView } from "../base";
import type { TextView } from "../types/elements";

class TextElement extends BaseView implements TextView {
  type = "text" as const;

  constructor(public content: string) {
    super();
  }

  bold(): this {
    return this;
  }
}

export function Text(content: string): TextElement;
export function Text(props: { value: string }): TextElement;
export function Text(contentOrProps: string | { value: string }): TextElement {
  const content = typeof contentOrProps === "string" ? contentOrProps : contentOrProps.value;
  return new TextElement(content);
}
