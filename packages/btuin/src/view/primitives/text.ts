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

export function Text(content: string): TextElement {
  return new TextElement(content);
}
