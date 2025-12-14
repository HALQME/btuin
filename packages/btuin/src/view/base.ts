import type { ColorValue, OutlineOptions } from "@btuin/renderer";
import type { ViewElement } from "./types/elements";

export interface ViewProps {
  width?: number | "auto";
  height?: number | "auto";
  foregroundColor?: ColorValue;
  backgroundColor?: ColorValue;
  outline?: OutlineOptions;

  key?: string;
}

export abstract class View<Props extends ViewProps = ViewProps> {
  constructor(protected props: Props) {}

  protected clone(overrides: Partial<Props>): this {
    const Constructor = this.constructor as new (props: Props) => this;
    return new Constructor({ ...this.props, ...overrides });
  }

  width(value: number | "auto"): this {
    return this.clone({ width: value } as Partial<Props>);
  }

  height(value: number | "auto"): this {
    return this.clone({ height: value } as Partial<Props>);
  }

  foreground(color: ColorValue): this {
    return this.clone({ foregroundColor: color } as Partial<Props>);
  }

  background(color: ColorValue): this {
    return this.clone({ backgroundColor: color } as Partial<Props>);
  }

  border(style: "single" | "double" = "single", color?: ColorValue): this {
    return this.clone({ outline: { style, color } } as Partial<Props>);
  }

  abstract render(): ViewElement;
}
