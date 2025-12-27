import { BaseView } from "../base";
import { markLayoutDirty, markRenderDirty } from "../dirty";
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
    // Content changes can affect intrinsic measurement when width/height are auto/unspecified.
    // In that case we must invalidate layout, otherwise the render loop may reuse a stale
    // layout map and produce clipping/overlap artifacts.
    if (
      this.style.width === undefined ||
      this.style.width === "auto" ||
      this.style.height === undefined ||
      this.style.height === "auto"
    ) {
      markLayoutDirty();
      return;
    }

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
