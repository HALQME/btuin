/**
 * Component Lifecycle Hooks
 *
 * Vue-like lifecycle hooks for btuin components.
 * These hooks are called during different phases of a component's lifecycle.
 */

import type { KeyEvent } from "../terminal/types/key-event";

export type LifecycleHook = () => void;
export type KeyEventHook = (event: KeyEvent) => void | boolean;
export type TickHook = () => void;

/**
 * Current component instance context
 * Set during component setup execution
 */
let currentInstance: ComponentInstance | null = null;

export interface ComponentInstance {
  uid: number;
  isMounted: boolean;
  name?: string;

  mountedHooks: LifecycleHook[];
  unmountedHooks: LifecycleHook[];
  updatedHooks: LifecycleHook[];
  beforeUpdateHooks: LifecycleHook[];

  keyHooks: KeyEventHook[];
  tickHooks: Array<{ hook: TickHook; interval: number; timer?: any }>;

  effects: Array<() => void>;
}

class ComponentUidGenerator {
  private counter = 0;

  next(): number {
    return this.counter++;
  }
}

const uidGenerator = new ComponentUidGenerator();

export function createComponentInstance(): ComponentInstance {
  return {
    uid: uidGenerator.next(),
    isMounted: false,
    mountedHooks: [],
    unmountedHooks: [],
    updatedHooks: [],
    beforeUpdateHooks: [],
    keyHooks: [],
    tickHooks: [],
    effects: [],
  };
}

export function setCurrentInstance(instance: ComponentInstance | null) {
  currentInstance = instance;
}

export function getCurrentInstance(): ComponentInstance | null {
  return currentInstance;
}

function injectHook(
  type: keyof Pick<
    ComponentInstance,
    "mountedHooks" | "unmountedHooks" | "updatedHooks" | "beforeUpdateHooks"
  >,
  hook: LifecycleHook,
) {
  if (!currentInstance) {
    console.warn(`${type} hook called outside of component init()`);
    return;
  }
  currentInstance[type].push(hook);
}

export function onMounted(hook: LifecycleHook) {
  injectHook("mountedHooks", hook);
}

export function onUnmounted(hook: LifecycleHook) {
  injectHook("unmountedHooks", hook);
}

export function onUpdated(hook: LifecycleHook) {
  injectHook("updatedHooks", hook);
}

export function onBeforeUpdate(hook: LifecycleHook) {
  injectHook("beforeUpdateHooks", hook);
}

export function onKey(hook: KeyEventHook) {
  if (!currentInstance) {
    console.warn("onKey called outside of component init()");
    return;
  }
  currentInstance.keyHooks.push(hook);
}

export function onTick(hook: TickHook, interval = 1000) {
  if (!currentInstance) {
    console.warn("onTick called outside of component init()");
    return;
  }
  currentInstance.tickHooks.push({ hook, interval });
}

export function invokeHooks(hooks: LifecycleHook[]) {
  for (const hook of hooks) {
    try {
      hook();
    } catch (error) {
      console.error("Error in lifecycle hook:", error);
    }
  }
}

export function invokeKeyHooks(hooks: KeyEventHook[], event: KeyEvent): boolean {
  for (const hook of hooks) {
    try {
      const result = hook(event);
      if (result === true) return true;
    } catch (error) {
      console.error("Error in key event hook:", error);
    }
  }
  return false;
}

export function startTickTimers(instance: ComponentInstance) {
  for (const tickHook of instance.tickHooks) {
    const timer = setInterval(
      () => {
        try {
          tickHook.hook();
        } catch (error) {
          console.error("Error in tick hook:", error);
        }
      },
      Math.max(1, tickHook.interval),
    );

    tickHook.timer = timer;
  }
}

export function stopTickTimers(instance: ComponentInstance) {
  for (const tickHook of instance.tickHooks) {
    if (tickHook.timer) {
      clearInterval(tickHook.timer);
      tickHook.timer = undefined;
    }
  }
}

export function unmountInstance(instance: ComponentInstance) {
  stopTickTimers(instance);

  const shouldInvokeUnmountedHooks = instance.isMounted;
  instance.isMounted = false;

  if (shouldInvokeUnmountedHooks) {
    invokeHooks(instance.unmountedHooks);
  }

  for (const cleanup of instance.effects) {
    try {
      cleanup();
    } catch (error) {
      console.error("Error in effect cleanup:", error);
    }
  }

  instance.effects.length = 0;
}
