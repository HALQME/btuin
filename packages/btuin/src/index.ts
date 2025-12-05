/**
 * btuin - Vue-like TUI Framework for Bun
 *
 * A reactive Terminal User Interface framework with Vue-like API.
 *
 * @example
 * ```typescript
 * import { createApp, ref, onKey, Paragraph } from 'btuin';
 *
 * const app = createApp({
 *   setup() {
 *     const count = ref(0);
 *
 *     onKey((key) => {
 *       if (key.name === 'up') count.value++;
 *       if (key.name === 'q') process.exit(0);
 *     });
 *
 *     return () => Paragraph({
 *       text: `Count: ${count.value}`,
 *       align: 'center'
 *     });
 *   }
 * });
 *
 * app.mount();
 * ```
 */

// Reactivity System
export {
  reactive,
  isReactive,
  toRaw,
  shallowReactive,
  ref,
  shallowRef,
  isRef,
  unref,
  toRef,
  toRefs,
  customRef,
  computed,
  watch,
  watchEffect,
  effect,
  stop,
  type Ref,
  type ComputedRef,
  type WatchSource,
  type WatchCallback,
  type WatchOptions,
  type WatchStopHandle,
} from "./reactivity";

// Component System
export {
  defineComponent,
  onMounted,
  onUnmounted,
  onUpdated,
  onBeforeUpdate,
  onKey,
  onTick,
  getCurrentInstance,
  type Component,
  type ComponentOptions,
  type ComponentInstance,
  type RenderFunction,
  type SetupContext,
  type PropOptions,
} from "./component";

// App Creation
export { createApp, type AppConfig, type AppInstance, type MountOptions } from "./runtime/app";

// Elements (re-export existing)
export * from "./elements";

// Runtime utilities
export {
  patchConsole,
  onStdout,
  onStderr,
  isCapturing,
  getOriginalStdout,
  getOriginalStderr,
  createConsoleCapture,
  renderConsoleOutput,
  type ConsoleLine,
  type ConsoleCaptureHandle,
} from "./terminal";

// Error handling
export {
  createErrorContext,
  createErrorHandler,
  type ErrorContext,
  type ErrorHandler,
} from "./runtime/error-boundary";

// Layout and rendering utilities
export { layout, renderElement } from "./layout";
export { defineElement, createModuleElement } from "./layout/define-element";
export type { ElementModule } from "./layout/element-module";

// Buffer utilities
export {
  createBuffer,
  cloneBuffer,
  drawText,
  fillRect,
  setCell,
  resolveColor,
  type Buffer2D,
} from "./buffer";

// Types
export type { ViewElement, BaseElement, FocusContext, FocusTarget } from "@btuin/types/elements";

export type { KeyEvent, KeyHandler } from "@btuin/types/key-event";
export type { Rect, SizeValue } from "@btuin/types/geometry";
export type { ColorValue } from "@btuin/types/color";
export type { OutlineOptions } from "@btuin/types/styling";
