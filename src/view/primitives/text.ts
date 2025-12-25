import { BaseView } from "../base";
import { markRenderDirty } from "../dirty";
import type { TextView } from "../types/elements";

class TextElement extends BaseView implements TextView {
  type = "text" as const;

  #content: string;

  constructor(content: string) {
    super();
    this.#content = content;
  }

  get content(): string {
    return this.#content;
  }

  set content(value: string) {
    if (this.#content === value) return;
    this.#content = value;
    // By default, treat content changes as render-only; layout should be driven by explicit
    // layout styles rather than intrinsic text measurement (keeps TUI updates cheap).
    markRenderDirty();
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
