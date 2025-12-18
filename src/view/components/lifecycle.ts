/**
 * Component Lifecycle Hooks
 *
 * Vue-like lifecycle hooks for btuin components.
 * These hooks are called during different phases of a component's lifecycle.
 */

import type { KeyEvent } from "../../terminal";

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

  // Lifecycle hooks
  mountedHooks: LifecycleHook[];
  unmountedHooks: LifecycleHook[];
  updatedHooks: LifecycleHook[];
  beforeUpdateHooks: LifecycleHook[];

  // Event hooks
  keyHooks: KeyEventHook[];
  tickHooks: Array<{ hook: TickHook; interval: number; timer?: any }>;

  // Cleanup
  effects: Array<() => void>;
}

/**
 * Component UID generator - encapsulated in a singleton
 */
class ComponentUidGenerator {
  private counter = 0;

  next(): number {
    return this.counter++;
  }
}

const uidGenerator = new ComponentUidGenerator();

/**
 * Creates a new component instance
 */
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

/**
 * Sets the current component instance
 * @internal
 */
export function setCurrentInstance(instance: ComponentInstance | null) {
  currentInstance = instance;
}

/**
 * Gets the current component instance
 * @internal
 */
export function getCurrentInstance(): ComponentInstance | null {
  return currentInstance;
}

/**
 * Registers a lifecycle hook
 */
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

/**
 * Called after the component has been mounted to the DOM.
 *
 * @example
 * ```typescript
 * init() {
 *   onMounted(() => {
 *     console.log('Component mounted!');
 *   });
 * }
 * ```
 *
 * @param hook - Function to call on mount
 */
export function onMounted(hook: LifecycleHook) {
  injectHook("mountedHooks", hook);
}

/**
 * Called before the component is unmounted.
 * Use this for cleanup operations.
 *
 * @example
 * ```typescript
 * init() {
 *   const timer = setInterval(() => {}, 1000);
 *
 *   onUnmounted(() => {
 *     clearInterval(timer);
 *   });
 * }
 * ```
 *
 * @param hook - Function to call on unmount
 */
export function onUnmounted(hook: LifecycleHook) {
  injectHook("unmountedHooks", hook);
}

/**
 * Called after the component has updated.
 *
 * @example
 * ```typescript
 * init() {
 *   onUpdated(() => {
 *     console.log('Component updated!');
 *   });
 * }
 * ```
 *
 * @param hook - Function to call after update
 */
export function onUpdated(hook: LifecycleHook) {
  injectHook("updatedHooks", hook);
}

/**
 * Called before the component updates.
 *
 * @example
 * ```typescript
 * init() {
 *   onBeforeUpdate(() => {
 *     console.log('About to update...');
 *   });
 * }
 * ```
 *
 * @param hook - Function to call before update
 */
export function onBeforeUpdate(hook: LifecycleHook) {
  injectHook("beforeUpdateHooks", hook);
}

/**
 * Registers a keyboard event handler for the component.
 * The handler is called when a key event occurs.
 * Return true to stop event propagation.
 *
 * @example
 * ```typescript
 * init() {
 *   onKey((event) => {
 *     if (event.name === 'up') {
 *       count.value++;
 *       return true; // Stop propagation
 *     }
 *   });
 * }
 * ```
 *
 * @param hook - Function to call on key event
 */
export function onKey(hook: KeyEventHook) {
  if (!currentInstance) {
    console.warn("onKey called outside of component init()");
    return;
  }
  currentInstance.keyHooks.push(hook);
}

/**
 * Registers a periodic tick handler for the component.
 * The handler is called at the specified interval.
 *
 * @example
 * ```typescript
 * init() {
 *   const count = ref(0);
 *
 *   // Increment every second
 *   onTick(() => {
 *     count.value++;
 *   }, 1000);
 * }
 * ```
 *
 * @param hook - Function to call on tick
 * @param interval - Interval in milliseconds (default: 1000)
 */
export function onTick(hook: TickHook, interval = 1000) {
  if (!currentInstance) {
    console.warn("onTick called outside of component init()");
    return;
  }
  currentInstance.tickHooks.push({ hook, interval });
}

/**
 * Invokes lifecycle hooks
 * @internal
 */
export function invokeHooks(hooks: LifecycleHook[]) {
  for (const hook of hooks) {
    try {
      hook();
    } catch (error) {
      console.error("Error in lifecycle hook:", error);
    }
  }
}

/**
 * Invokes key event hooks
 * Returns true if any hook stopped propagation
 * @internal
 */
export function invokeKeyHooks(hooks: KeyEventHook[], event: KeyEvent): boolean {
  for (const hook of hooks) {
    try {
      const result = hook(event);
      if (result === true) {
        return true; // Stop propagation
      }
    } catch (error) {
      console.error("Error in key event hook:", error);
    }
  }
  return false;
}

/**
 * Starts all tick timers for a component instance
 * @internal
 */
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

/**
 * Stops all tick timers for a component instance
 * @internal
 */
export function stopTickTimers(instance: ComponentInstance) {
  for (const tickHook of instance.tickHooks) {
    if (tickHook.timer) {
      clearInterval(tickHook.timer);
      tickHook.timer = undefined;
    }
  }
}

/**
 * Unmounts a component instance and runs cleanup
 * @internal
 */
export function unmountInstance(instance: ComponentInstance) {
  // Stop tick timers
  stopTickTimers(instance);

  const shouldInvokeUnmountedHooks = instance.isMounted;
  instance.isMounted = false;

  if (shouldInvokeUnmountedHooks) {
    // Run unmounted hooks
    invokeHooks(instance.unmountedHooks);
  }

  // Run effect cleanups
  for (const cleanup of instance.effects) {
    try {
      cleanup();
    } catch (error) {
      console.error("Error in effect cleanup:", error);
    }
  }

  instance.effects.length = 0;
}
