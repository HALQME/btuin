/**
 * Effect Tracking and Triggering System
 *
 * Core of the reactivity system. Tracks dependencies between effects and reactive properties,
 * and triggers effects when dependencies change.
 */

export type EffectFn = () => void;
export type EffectScheduler = (effect: ReactiveEffect) => void;

export interface ReactiveEffectOptions {
  scheduler?: EffectScheduler;
  onStop?: () => void;
  lazy?: boolean;
}

export type EffectRunner = (() => void) & {
  effect: ReactiveEffect;
};

/**
 * Effect tracking state - encapsulated in a singleton
 */
class EffectTracker {
  private activeEffect: ReactiveEffect | undefined;
  private readonly targetMap = new WeakMap<any, Map<string | symbol, Set<ReactiveEffect>>>();

  getActiveEffect(): ReactiveEffect | undefined {
    return this.activeEffect;
  }

  setActiveEffect(effect: ReactiveEffect | undefined): void {
    this.activeEffect = effect;
  }

  getTargetMap(): WeakMap<any, Map<string | symbol, Set<ReactiveEffect>>> {
    return this.targetMap;
  }
}

const effectTracker = new EffectTracker();

/**
 * Reactive Effect class
 * Represents a function that depends on reactive data
 */
export class ReactiveEffect {
  active = true;
  deps: Set<ReactiveEffect>[] = [];
  onStop?: () => void;

  constructor(
    public fn: EffectFn,
    public scheduler?: EffectScheduler,
  ) {}

  run() {
    if (!this.active) {
      return this.fn();
    }

    try {
      effectTracker.setActiveEffect(this);
      // Clean up existing dependencies before re-tracking
      cleanupEffect(this);
      return this.fn();
    } finally {
      effectTracker.setActiveEffect(undefined);
    }
  }

  stop() {
    if (this.active) {
      cleanupEffect(this);
      if (this.onStop) {
        this.onStop();
      }
      this.active = false;
    }
  }
}

/**
 * Clean up effect from all its dependencies
 */
function cleanupEffect(effect: ReactiveEffect) {
  const { deps } = effect;
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i];
      if (dep) {
        dep.delete(effect);
      }
    }
    deps.length = 0;
  }
}

/**
 * Creates and runs an effect function.
 * The effect automatically tracks reactive dependencies and re-runs when they change.
 *
 * @example
 * ```typescript
 * const state = reactive({ count: 0 });
 *
 * effect(() => {
 *   console.log(`Count is: ${state.count}`);
 * });
 *
 * state.count++; // Logs: "Count is: 1"
 * ```
 *
 * @param fn - Function to run as an effect
 * @param options - Effect options (scheduler, onStop, lazy)
 * @returns ReactiveEffect instance
 */
export function effect(fn: EffectFn, options?: ReactiveEffectOptions): ReactiveEffect {
  const _effect = new ReactiveEffect(fn, options?.scheduler);

  if (options?.onStop) {
    _effect.onStop = options.onStop;
  }

  if (!options?.lazy) {
    _effect.run();
  }

  return _effect;
}

/**
 * Stops an effect, preventing it from running again.
 *
 * @example
 * ```typescript
 * const state = reactive({ count: 0 });
 * const eff = effect(() => console.log(state.count));
 *
 * stop(eff);
 * state.count++; // Effect won't run
 * ```
 *
 * @param effect - Effect to stop
 */
export function stop(effect: ReactiveEffect) {
  effect.stop();
}

/**
 * Tracks a dependency between the current active effect and a reactive property.
 * Called automatically when reactive properties are accessed.
 *
 * @internal
 * @param target - Target object
 * @param key - Property key being accessed
 */
export function track(target: object, key: string | symbol) {
  const activeEffect = effectTracker.getActiveEffect();
  if (!activeEffect) {
    return;
  }

  // Get or create dependency map for target
  const targetMap = effectTracker.getTargetMap();
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    depsMap = new Map();
    targetMap.set(target, depsMap);
  }

  // Get or create dependency set for key
  let dep = depsMap.get(key);
  if (!dep) {
    dep = new Set();
    depsMap.set(key, dep);
  }

  // Add current effect to dependency set
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect);
    activeEffect.deps.push(dep);
  }
}

/**
 * Triggers all effects that depend on a reactive property.
 * Called automatically when reactive properties are modified.
 *
 * @internal
 * @param target - Target object
 * @param key - Property key being modified
 */
export function trigger(target: object, key: string | symbol) {
  const targetMap = effectTracker.getTargetMap();
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    return;
  }

  const dep = depsMap.get(key);
  if (!dep) {
    return;
  }

  // Create a copy to avoid infinite loops during iteration
  const effects = new Set(dep);

  effects.forEach((effect) => {
    // If effect has a scheduler, use it; otherwise run directly
    if (effect.scheduler) {
      effect.scheduler(effect);
    } else {
      effect.run();
    }
  });
}

/**
 * Pauses tracking of reactive dependencies.
 * Useful when you want to read reactive values without creating dependencies.
 *
 * @example
 * ```typescript
 * const state = reactive({ count: 0 });
 *
 * effect(() => {
 *   pauseTracking();
 *   console.log(state.count); // Won't track this access
 *   resetTracking();
 * });
 * ```
 */
/**
 * Track control state - encapsulated in a singleton
 */
class TrackController {
  private shouldTrack = true;
  private readonly trackStack: boolean[] = [];

  pause(): void {
    this.trackStack.push(this.shouldTrack);
    this.shouldTrack = false;
  }

  enable(): void {
    this.trackStack.push(this.shouldTrack);
    this.shouldTrack = true;
  }

  reset(): void {
    const last = this.trackStack.pop();
    this.shouldTrack = last === undefined ? true : last;
  }

  isTracking(): boolean {
    return this.shouldTrack;
  }
}

const trackController = new TrackController();

export function pauseTracking() {
  trackController.pause();
}

export function enableTracking() {
  trackController.enable();
}

export function resetTracking() {
  trackController.reset();
}

/**
 * Gets the currently active effect (if any).
 *
 * @internal
 * @returns Current active effect or undefined
 */
export function getCurrentEffect(): ReactiveEffect | undefined {
  return effectTracker.getActiveEffect();
}
