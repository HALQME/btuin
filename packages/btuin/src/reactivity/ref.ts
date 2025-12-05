/**
 * Ref Implementation
 *
 * Provides reactive references for primitive values and objects.
 * Unlike reactive(), ref() wraps values in an object with a .value property.
 */

import { reactive, isReactive, toRaw } from "./reactive";
import { track, trigger } from "./effect";

const IS_REF_KEY = Symbol("__v_isRef");

export interface Ref<T = any> {
  value: T;
  [IS_REF_KEY]: true;
}

/**
 * Creates a reactive reference that holds a single value.
 * Access and modify the value through the .value property.
 *
 * @example
 * ```typescript
 * const count = ref(0);
 *
 * effect(() => {
 *   console.log(count.value); // Auto-tracks
 * });
 *
 * count.value++; // Triggers effect
 * ```
 *
 * @param value - Initial value
 * @returns Ref object
 */
export function ref<T>(value: T): Ref<T> {
  return createRef(value, false);
}

/**
 * Creates a shallow ref where only .value assignment triggers effects.
 * Nested property changes won't trigger effects.
 *
 * @example
 * ```typescript
 * const obj = shallowRef({ count: 0 });
 *
 * obj.value.count++; // Won't trigger effects
 * obj.value = { count: 1 }; // Will trigger effects
 * ```
 *
 * @param value - Initial value
 * @returns Shallow ref object
 */
export function shallowRef<T>(value: T): Ref<T> {
  return createRef(value, true);
}

class RefImpl<T> {
  private _value: T;
  private _rawValue: T;
  public readonly [IS_REF_KEY] = true;

  constructor(
    value: T,
    public readonly __v_isShallow: boolean,
  ) {
    this._rawValue = __v_isShallow ? value : toRaw(value);
    this._value = __v_isShallow ? value : convert(value);
  }

  get value() {
    track(this, "value");
    return this._value;
  }

  set value(newVal) {
    const useDirectValue = this.__v_isShallow || isReactive(newVal);
    newVal = useDirectValue ? newVal : toRaw(newVal);

    if (Object.is(newVal, this._rawValue)) {
      return;
    }

    this._rawValue = newVal;
    this._value = useDirectValue ? newVal : convert(newVal);
    trigger(this, "value");
  }
}

function createRef<T>(rawValue: T, shallow: boolean): Ref<T> {
  if (isRef(rawValue)) {
    return rawValue as Ref<T>;
  }
  return new RefImpl(rawValue, shallow) as unknown as Ref<T>;
}

/**
 * Convert value to reactive if it's an object
 */
function convert<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    return reactive(value as T extends object ? T : never) as T;
  }
  return value;
}

/**
 * Checks if a value is a ref.
 *
 * @example
 * ```typescript
 * const count = ref(0);
 * const obj = { value: 0 };
 *
 * isRef(count); // true
 * isRef(obj);   // false
 * ```
 *
 * @param value - Value to check
 * @returns True if value is a ref
 */
export function isRef<T>(value: any): value is Ref<T> {
  return !!(value && value[IS_REF_KEY] === true);
}

/**
 * Returns the inner value if the argument is a ref, otherwise return the argument itself.
 *
 * @example
 * ```typescript
 * const count = ref(5);
 *
 * unref(count); // 5
 * unref(10);    // 10
 * ```
 *
 * @param ref - Ref or plain value
 * @returns Inner value
 */
export function unref<T>(ref: T | Ref<T>): T {
  return isRef(ref) ? ref.value : ref;
}

/**
 * Creates a ref that is synchronized with a reactive object property.
 *
 * @example
 * ```typescript
 * const state = reactive({ count: 0 });
 * const countRef = toRef(state, 'count');
 *
 * countRef.value++; // Also updates state.count
 * state.count++;    // Also updates countRef.value
 * ```
 *
 * @param object - Reactive object
 * @param key - Property key
 * @returns Ref linked to the property
 */
export function toRef<T extends object, K extends keyof T>(object: T, key: K): Ref<T[K]> {
  const val = object[key];
  return (isRef(val) ? val : new ObjectRefImpl(object, key)) as Ref<T[K]>;
}

class ObjectRefImpl<T extends object, K extends keyof T> {
  public readonly [IS_REF_KEY] = true;

  constructor(
    private readonly _object: T,
    private readonly _key: K,
  ) {}

  get value() {
    return this._object[this._key];
  }

  set value(newVal) {
    this._object[this._key] = newVal;
  }
}

/**
 * Converts a reactive object to a plain object where each property is a ref.
 *
 * @example
 * ```typescript
 * const state = reactive({ count: 0, name: 'Alice' });
 * const refs = toRefs(state);
 *
 * refs.count.value++; // Updates state.count
 * ```
 *
 * @param object - Reactive object
 * @returns Object with refs
 */
export function toRefs<T extends object>(
  object: T,
): {
  [K in keyof T]: Ref<T[K]>;
} {
  const ret: any = {};
  for (const key in object) {
    ret[key] = toRef(object, key);
  }
  return ret;
}

/**
 * Creates a custom ref with explicit control over dependency tracking and trigger timing.
 *
 * @example
 * ```typescript
 * function useDebouncedRef(value: any, delay = 200) {
 *   let timeout: any;
 *   return customRef((track, trigger) => ({
 *     get() {
 *       track();
 *       return value;
 *     },
 *     set(newValue) {
 *       clearTimeout(timeout);
 *       timeout = setTimeout(() => {
 *         value = newValue;
 *         trigger();
 *       }, delay);
 *     }
 *   }));
 * }
 * ```
 *
 * @param factory - Factory function that receives track and trigger
 * @returns Custom ref
 */
export function customRef<T>(
  factory: (
    track: () => void,
    trigger: () => void,
  ) => {
    get: () => T;
    set: (value: T) => void;
  },
): Ref<T> {
  return new CustomRefImpl(factory) as unknown as Ref<T>;
}

class CustomRefImpl<T> {
  public readonly [IS_REF_KEY] = true;
  private readonly _get: () => T;
  private readonly _set: (value: T) => void;

  constructor(
    factory: (
      track: () => void,
      trigger: () => void,
    ) => {
      get: () => T;
      set: (value: T) => void;
    },
  ) {
    const { get, set } = factory(
      () => track(this, "value"),
      () => trigger(this, "value"),
    );
    this._get = get;
    this._set = set;
  }

  get value() {
    return this._get();
  }

  set value(newVal) {
    this._set(newVal);
  }
}
