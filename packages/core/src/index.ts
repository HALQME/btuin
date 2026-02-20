/**
 * btuin core entry point
 */

export { createApp, App, resetProcessHasActiveMount } from "./runtime";
export { defineComponent } from "./components";
export * from "./view";
export * from "./hooks/";

export { onBeforeUpdate, onKey, onMounted, onTick, onUnmounted, onUpdated } from "./components";
export { inject, provide, type InjectionKey } from "./components";
export type { KeyEvent } from "./terminal/types";

export * from "./reactivity";
