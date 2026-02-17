import { getCurrentInstance } from "./lifecycle";

export type InjectionKey<T> = symbol & { __btuin_injectionKey?: T };

export function provide<T>(key: InjectionKey<T> | string, value: T): void {
  const instance = getCurrentInstance();
  if (!instance) {
    console.warn("provide() called outside of component init()");
    return;
  }

  instance.provides.set(key, value);
}

export function inject<T>(key: InjectionKey<T> | string): T | undefined;
export function inject<T>(key: InjectionKey<T> | string, defaultValue: T): T;
export function inject<T>(key: InjectionKey<T> | string, defaultValue?: T): T | undefined {
  const instance = getCurrentInstance();
  if (!instance) {
    console.warn("inject() called outside of component init()");
    return defaultValue;
  }

  let cursor: typeof instance | null = instance;
  while (cursor) {
    if (cursor.provides.has(key)) {
      return cursor.provides.get(key) as T;
    }
    cursor = cursor.parent;
  }

  return defaultValue;
}
