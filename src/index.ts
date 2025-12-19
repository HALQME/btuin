/**
 * btuin core entry point
 */

export type {
  Component,
  ComponentDefinition,
  ComponentInitContext,
  ExitReason,
  KeyHandler,
  RuntimeContext,
  TickHandler,
} from "./component";
export { defineComponent } from "./view/components/component";
export * from "./runtime";

export * from "./view/base";
export * from "./view/layout";
export * from "./view/primitives";
export * from "./layout";
export * from "./renderer";
export * from "./grapheme";

export * from "./reactivity";

export * from "./types";

export type { KeyEvent } from "./terminal";
