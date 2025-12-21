/**
 * btuin core entry point
 */

export { createApp, App } from "./runtime/app";
export { defineComponent } from "./components/component";
export * from "./view";

export {
  onBeforeUpdate,
  onKey,
  onMounted,
  onTick,
  onUnmounted,
  onUpdated,
} from "./components/lifecycle";

export * from "./reactivity";

export type {
  Component,
  ComponentDefinition,
  ComponentInitContext,
  ExitReason,
  KeyHandler,
  RuntimeContext,
  TickHandler,
} from "./components/core";
export type { App as AppType, CreateAppOptions, MountOptions } from "./runtime/types";
export type { KeyEvent } from "./terminal";
