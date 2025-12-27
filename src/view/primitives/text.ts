import { BaseView, type ViewProps } from "../base";
import { markLayoutDirty, markRenderDirty } from "../dirty";
import type { TextView } from "../types/elements";

class TextElement extends BaseView implements TextView {
  type = "text" as const;

  #content: string;

  constructor(props: { content: string } & ViewProps) {
    super(props);
    this.#content = props.content;
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
export function Text(props: { value: string } & ViewProps): TextElement;
export function Text(
  contentOrProps: string | ({ value: string } & ViewProps)
): TextElement {
  if (typeof contentOrProps === "string") {
    return new TextElement({ content: contentOrProps });
  }
  const { value, ...props } = contentOrProps;
  return new TextElement({ content: value, ...props });
}
