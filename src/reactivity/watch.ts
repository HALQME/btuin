/**
 * Watch and WatchEffect Implementation
 *
 * Provides reactive side effects that run when dependencies change.
 * Similar to Vue's watch and watchEffect APIs.
 */

import { ReactiveEffect } from "./effect";
import { isRef, type Ref } from "./ref";
import { isReactive } from "./reactive";

export type WatchSource<T = any> = Ref<T> | (() => T);
export type WatchCallback<T = any> = (
  value: T,
  oldValue: T,
  onCleanup: (fn: () => void) => void,
) => void;

export interface WatchOptions {
  immediate?: boolean;
  deep?: boolean;
  flush?: "sync" | "pre" | "post";
}

export type WatchStopHandle = () => void;

/**
 * Watches one or more reactive sources and calls a callback when they change.
 *
 * @example
 * ```typescript
 * const count = ref(0);
 *
 * watch(count, (newValue, oldValue) => {
 *   console.log(`Count changed from ${oldValue} to ${newValue}`);
 * });
 *
 * count.value++; // Logs: "Count changed from 0 to 1"
 * ```
 *
 * @example Watch multiple sources
 * ```typescript
 * const x = ref(0);
 * const y = ref(0);
 *
 * watch([x, y], ([newX, newY], [oldX, oldY]) => {
 *   console.log(`x: ${oldX} -> ${newX}, y: ${oldY} -> ${newY}`);
 * });
 * ```
 *
 * @example Watch with immediate option
 * ```typescript
 * watch(
 *   () => state.count,
 *   (value) => console.log(value),
 *   { immediate: true }
 * );
 * ```
 *
 * @param source - Reactive source(s) to watch
 * @param callback - Callback to run when source changes
 * @param options - Watch options
 * @returns Stop function
 */
export function watch<T>(
  source: WatchSource<T>,
  callback: WatchCallback<T>,
  options?: WatchOptions,
): WatchStopHandle;
export function watch<T extends readonly WatchSource[]>(
  sources: [...T],
  callback: WatchCallback<{
    [K in keyof T]: T[K] extends WatchSource<infer V> ? V : never;
  }>,
  options?: WatchOptions,
): WatchStopHandle;
export function watch(
  source: any,
  callback: WatchCallback,
  options: WatchOptions = {},
): WatchStopHandle {
  return doWatch(source, callback, options);
}

/**
 * Immediately runs a function while reactively tracking its dependencies,
 * and re-runs it whenever the dependencies change.
 *
 * @example
 * ```typescript
 * const count = ref(0);
 *
 * watchEffect(() => {
 *   console.log(`Count is: ${count.value}`);
 * });
 *
 * count.value++; // Logs: "Count is: 1"
 * ```
 *
 * @example With cleanup
 * ```typescript
 * watchEffect((onCleanup) => {
 *   const timer = setInterval(() => {
 *     console.log(count.value);
 *   }, 1000);
 *
 *   onCleanup(() => clearInterval(timer));
 * });
 * ```
 *
 * @param effect - Effect function to run
 * @param options - Watch options
 * @returns Stop function
 */
export function watchEffect(
  effect: (onCleanup: (fn: () => void) => void) => void,
  options?: WatchOptions,
): WatchStopHandle {
  return doWatch(effect, null, options);
}

function doWatch(
  source: any,
  callback: WatchCallback | null,
  { immediate, deep, flush = "sync" }: WatchOptions = {},
): WatchStopHandle {
  let getter: () => any;
  let isMultiSource = false;

  if (isRef(source)) {
    getter = () => source.value;
  } else if (isReactive(source)) {
    getter = () => source;
    deep = true;
  } else if (Array.isArray(source)) {
    isMultiSource = true;
    getter = () =>
      source.map((s) => {
        if (isRef(s)) {
          return s.value;
        } else if (isReactive(s)) {
          return traverse(s);
        } else if (typeof s === "function") {
          return s();
        }
      });
  } else if (typeof source === "function") {
    if (callback) {
      // watch(() => ...)
      getter = () => source();
    } else {
      // watchEffect
      getter = () => {
        if (cleanup) {
          cleanup();
        }
        const onCleanup = (fn: () => void) => {
          cleanup = fn;
        };
        return source(onCleanup);
      };
    }
  } else {
    getter = () => {};
  }

  if (callback && deep) {
    const baseGetter = getter;
    getter = () => traverse(baseGetter());
  }

  let cleanup: (() => void) | undefined;
  const onCleanup = (fn: () => void) => {
    cleanup = fn;
  };

  let oldValue: any;

  const job = () => {
    if (!effect.active) {
      return;
    }

    if (callback) {
      const newValue = effect.run();
      if (deep || isMultiSource || hasChanged(newValue, oldValue)) {
        callback(newValue, oldValue, onCleanup);
        if (cleanup) {
          cleanup();
        }
        oldValue = newValue;
      }
    } else {
      // watchEffect
      effect.run();
    }
  };

  const effect = new ReactiveEffect(getter, () => {
    if (flush === "sync") {
      job();
    } else {
      // For TUI, we can just run synchronously for now
      // In the future, we could queue updates
      job();
    }
  });

  // Initial run
  if (callback) {
    if (immediate) {
      job();
    } else {
      oldValue = effect.run();
    }
  } else {
    // watchEffect runs immediately
    effect.run();
  }

  return () => {
    effect.stop();
    if (cleanup) {
      cleanup();
    }
  };
}

/**
 * Deeply traverse an object to track all nested properties
 */
function traverse(value: unknown, seen = new Set<any>()): unknown {
  if (!value || typeof value !== "object" || seen.has(value)) {
    return value;
  }

  seen.add(value);

  if (isRef(value)) {
    traverse(value.value, seen);
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], seen);
    }
  } else {
    for (const key in value) {
      traverse(Reflect.get(value, key), seen);
    }
  }

  return value;
}

/**
 * Check if a value has changed
 */
function hasChanged(value: any, oldValue: any): boolean {
  return !Object.is(value, oldValue);
}
