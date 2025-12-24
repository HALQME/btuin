/**
 * Reactivity System
 *
 * Vue-like reactivity system for btuin TUI framework.
 * Provides reactive state management, computed values, and watchers.
 *
 * @example
 * ```typescript
 * import { reactive, ref, computed, watch } from 'btuin';
 *
 * // Reactive object
 * const state = reactive({ count: 0, name: 'Alice' });
 *
 * // Reactive primitive
 * const count = ref(0);
 *
 * // Computed value
 * const double = computed(() => count.value * 2);
 *
 * // Watch changes
 * watch(count, (newVal, oldVal) => {
 *   console.log(`Changed from ${oldVal} to ${newVal}`);
 * });
 * ```
 */

export { reactive, isReactive, toRaw, shallowReactive } from "./reactive";

export { ref, shallowRef, isRef, unref, toRef, toRefs, customRef } from "./ref";

export {
  computed,
} from "./computed";

export {
  watch,
  watchEffect,
} from "./watch";

export {
  effect,
  stop,
  track,
  trigger,
  pauseTracking,
  enableTracking,
  resetTracking,
  getCurrentEffect,
  ReactiveEffect,
} from "./effect";
