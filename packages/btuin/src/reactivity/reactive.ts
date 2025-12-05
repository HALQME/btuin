/**
 * Reactive State Implementation
 *
 * Provides Vue-like reactive state management using ES6 Proxy.
 * When a reactive object is mutated, all dependent effects are automatically triggered.
 */

import { track, trigger } from "./effect";

const RAW_KEY = Symbol("__v_raw");
const IS_REACTIVE_KEY = Symbol("__v_isReactive");

export interface ReactiveFlags {
  [RAW_KEY]?: any;
  [IS_REACTIVE_KEY]?: boolean;
}

const reactiveMap = new WeakMap<object, any>();

/**
 * Creates a reactive proxy of an object.
 * When properties are accessed, dependencies are tracked.
 * When properties are modified, dependent effects are triggered.
 *
 * @example
 * ```typescript
 * const state = reactive({ count: 0, name: 'Alice' });
 *
 * effect(() => {
 *   console.log(state.count); // Auto-tracks dependency
 * });
 *
 * state.count++; // Triggers effect automatically
 * ```
 *
 * @param target - Plain object to make reactive
 * @returns Reactive proxy of the object
 */
export function reactive<T extends object>(target: T): T {
  // Don't wrap if already reactive
  if (isReactive(target)) {
    return target;
  }

  // Return existing reactive if already created
  const existingProxy = reactiveMap.get(target);
  if (existingProxy) {
    return existingProxy;
  }

  // Create reactive proxy
  const proxy = new Proxy(target, {
    get(target, key, receiver) {
      // Handle reactive flags
      if (key === IS_REACTIVE_KEY) {
        return true;
      }
      if (key === RAW_KEY) {
        return target;
      }

      // Track dependency
      track(target, key as string | symbol);

      const result = Reflect.get(target, key, receiver);

      // Deep reactive: if result is object, make it reactive too
      if (result !== null && typeof result === "object") {
        return reactive(result);
      }

      return result;
    },

    set(target, key, value, receiver) {
      const oldValue = Reflect.get(target, key, receiver);
      const result = Reflect.set(target, key, value, receiver);

      // Only trigger if value actually changed
      if (oldValue !== value) {
        trigger(target, key as string | symbol);
      }

      return result;
    },

    deleteProperty(target, key) {
      const hadKey = Object.prototype.hasOwnProperty.call(target, key);
      const result = Reflect.deleteProperty(target, key);

      if (hadKey) {
        trigger(target, key as string | symbol);
      }

      return result;
    },
  });

  reactiveMap.set(target, proxy);
  return proxy;
}

/**
 * Checks if a value is a reactive proxy.
 *
 * @example
 * ```typescript
 * const obj = { count: 0 };
 * const state = reactive(obj);
 *
 * isReactive(obj);   // false
 * isReactive(state); // true
 * ```
 *
 * @param value - Value to check
 * @returns True if value is reactive
 */
export function isReactive(value: unknown): boolean {
  return !!(value && (value as ReactiveFlags)[IS_REACTIVE_KEY]);
}

/**
 * Returns the raw, non-reactive object from a reactive proxy.
 *
 * @example
 * ```typescript
 * const state = reactive({ count: 0 });
 * const raw = toRaw(state);
 *
 * raw.count++; // Won't trigger effects
 * ```
 *
 * @param observed - Reactive proxy
 * @returns Original non-reactive object
 */
export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as ReactiveFlags)[RAW_KEY];
  return raw ? toRaw(raw) : observed;
}

/**
 * Creates a shallow reactive object.
 * Only root-level properties are reactive, nested objects are not.
 *
 * @example
 * ```typescript
 * const state = shallowReactive({
 *   count: 0,
 *   nested: { value: 1 }
 * });
 *
 * // count is reactive
 * state.count++; // Triggers effects
 *
 * // nested.value is NOT reactive
 * state.nested.value++; // Won't trigger effects
 * ```
 *
 * @param target - Plain object to make shallowly reactive
 * @returns Shallow reactive proxy
 */
export function shallowReactive<T extends object>(target: T): T {
  if (isReactive(target)) {
    return target;
  }

  const existingProxy = reactiveMap.get(target);
  if (existingProxy) {
    return existingProxy;
  }

  const proxy = new Proxy(target, {
    get(target, key, receiver) {
      if (key === IS_REACTIVE_KEY) {
        return true;
      }
      if (key === RAW_KEY) {
        return target;
      }

      track(target, key as string | symbol);
      return Reflect.get(target, key, receiver);
    },

    set(target, key, value, receiver) {
      const oldValue = Reflect.get(target, key, receiver);
      const result = Reflect.set(target, key, value, receiver);

      if (oldValue !== value) {
        trigger(target, key as string | symbol);
      }

      return result;
    },

    deleteProperty(target, key) {
      const hadKey = Object.prototype.hasOwnProperty.call(target, key);
      const result = Reflect.deleteProperty(target, key);

      if (hadKey) {
        trigger(target, key as string | symbol);
      }

      return result;
    },
  });

  reactiveMap.set(target, proxy);
  return proxy;
}
