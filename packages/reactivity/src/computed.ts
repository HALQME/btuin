/**
 * Computed Values Implementation
 *
 * Provides lazily evaluated, cached computed properties that automatically
 * track dependencies and update when dependencies change.
 */

import { ReactiveEffect, hasDep, track, trigger } from "./effect";
import { type Ref } from "./ref";

const IS_REF_KEY = Symbol("__v_isRef");

export interface ComputedRef<T = any> extends Ref<T> {
  readonly value: T;
  [IS_REF_KEY]: true;
}

export interface WritableComputedRef<T = any> extends Ref<T> {
  value: T;
  [IS_REF_KEY]: true;
}

export type ComputedGetter<T> = (...args: any[]) => T;
export type ComputedSetter<T> = (value: T) => void;

export interface WritableComputedOptions<T> {
  get: ComputedGetter<T>;
  set: ComputedSetter<T>;
}

/**
 * Creates a computed value that automatically tracks reactive dependencies
 * and caches the result until dependencies change.
 *
 * @example
 * ```typescript
 * const count = ref(1);
 * const double = computed(() => count.value * 2);
 *
 * console.log(double.value); // 2
 * count.value = 2;
 * console.log(double.value); // 4
 * ```
 *
 * @example Writable computed
 * ```typescript
 * const firstName = ref('John');
 * const lastName = ref('Doe');
 *
 * const fullName = computed({
 *   get: () => `${firstName.value} ${lastName.value}`,
 *   set: (value) => {
 *     const parts = value.split(' ');
 *     firstName.value = parts[0];
 *     lastName.value = parts[1];
 *   }
 * });
 *
 * console.log(fullName.value); // "John Doe"
 * fullName.value = "Jane Smith";
 * console.log(firstName.value); // "Jane"
 * ```
 *
 * @param getterOrOptions - Getter function or options object with get/set
 * @returns Computed ref
 */
export function computed<T>(getter: ComputedGetter<T>): ComputedRef<T>;
export function computed<T>(options: WritableComputedOptions<T>): WritableComputedRef<T>;
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
): ComputedRef<T> | WritableComputedRef<T> {
  let getter: ComputedGetter<T>;
  let setter: ComputedSetter<T> | undefined;

  if (typeof getterOrOptions === "function") {
    getter = getterOrOptions;
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }

  const impl = new ComputedRefImpl(getter, setter);
  return impl as unknown as any;
}

class ComputedRefImpl<T> {
  public readonly [IS_REF_KEY] = true;
  public readonly __v_isReadonly: boolean;

  private _value!: T;
  private _dirty = true;
  private readonly effect: ReactiveEffect;

  constructor(
    getter: ComputedGetter<T>,
    private readonly _setter?: ComputedSetter<T>,
  ) {
    this.__v_isReadonly = !_setter;
    this.effect = new ReactiveEffect(getter, () => {
      // Only notify dependents if the computed value actually changes.
      if (this._dirty) {
        return;
      }

      if (!hasDep(this, "value")) {
        this._dirty = true;
        return;
      }

      const nextValue = this.effect.run()!;
      if (!Object.is(nextValue, this._value)) {
        this._value = nextValue;
        trigger(this, "value");
      }
    });
  }

  get value() {
    // Track this computed as a dependency
    track(this, "value");

    // Re-compute if dirty
    if (this._dirty) {
      this._dirty = false;
      this._value = this.effect.run()!;
    }

    return this._value;
  }

  set value(newValue: T) {
    if (this._setter) {
      this._setter(newValue);
    }
  }
}

/**
 * Type utility to unwrap nested refs in computed return types
 */
export type ComputedUnwrap<T> = T extends Ref<infer V> ? ComputedUnwrap<V> : T;
