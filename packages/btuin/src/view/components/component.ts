/**
 * Component Definition and Setup System
 *
 * Provides Vue-like component definition with setup() function,
 * props, emits, and render function.
 */
import type { ViewElement } from "../types/elements";
import type { KeyEvent } from "@btuin/terminal";
import {
  createComponentInstance,
  setCurrentInstance,
  invokeHooks,
  invokeKeyHooks,
  startTickTimers,
  unmountInstance,
  type ComponentInstance,
} from "./lifecycle";

export interface SetupContext {
  emit: (event: string, ...args: any[]) => void;
  expose: (exposed: Record<string, any>) => void;
}

export type RenderFunction = () => ViewElement;

export interface ComponentOptions {
  name?: string;
  props?: Record<string, PropOptions>;
  emits?: string[];
  setup: (props: any, context: SetupContext) => RenderFunction | void;
}

export interface PropOptions {
  type?: any;
  default?: any;
  required?: boolean;
  validator?: (value: any) => boolean;
}

export interface Component {
  options: ComponentOptions;
  instances: WeakMap<any, MountedComponent>;
}

export interface MountedComponent {
  instance: ComponentInstance;
  props: any;
  render: RenderFunction;
  emitCallbacks: Map<string, Array<(...args: any[]) => void>>;
  exposed: Record<string, any>;
  renderEffect: any;
  lastElement: ViewElement | null;
}

/**
 * Defines a new component with Vue-like API.
 *
 * @example
 * ```typescript
 * const Counter = defineComponent({
 *   name: 'Counter',
 *   props: {
 *     initial: { type: Number, default: 0 }
 *   },
 *   setup(props, { emit }) {
 *     const count = ref(props.initial);
 *
 *     onKey((key) => {
 *       if (key.name === 'up') {
 *         count.value++;
 *         emit('change', count.value);
 *       }
 *     });
 *
 *     return () => Paragraph({
 *       text: `Count: ${count.value}`
 *     });
 *   }
 * });
 * ```
 *
 * @param options - Component options
 * @returns Component definition
 */
export function defineComponent(options: ComponentOptions): Component {
  return {
    options,
    instances: new WeakMap(),
  };
}

/**
 * Mounts a component and creates its instance.
 *
 * @internal
 * @param component - Component to mount
 * @param props - Props to pass to component
 * @param key - Unique key for this mount (optional)
 * @returns Mounted component
 */
export function mountComponent(component: Component, props: any = {}, key?: any): MountedComponent {
  // Check if already mounted with this key
  const mountKey = key ?? Symbol();
  let mounted = component.instances.get(mountKey);

  if (mounted) {
    // Update props if changed
    if (props !== mounted.props) {
      mounted.props = props;
    }
    return mounted;
  }

  // Create component instance
  const instance = createComponentInstance();

  // Validate and normalize props
  const normalizedProps = normalizeProps(component.options.props || {}, props);

  // Setup emit callbacks
  const emitCallbacks = new Map<string, Array<(...args: any[]) => void>>();

  const context: SetupContext = {
    emit: (event: string, ...args: any[]) => {
      const callbacks = emitCallbacks.get(event);
      if (callbacks) {
        for (const callback of callbacks) {
          callback(...args);
        }
      }
    },
    expose: (exposed: Record<string, any>) => {
      mounted!.exposed = exposed;
    },
  };

  // Run setup with current instance context
  setCurrentInstance(instance);
  let render: RenderFunction;

  try {
    const setupResult = component.options.setup(normalizedProps, context);

    if (typeof setupResult === "function") {
      render = setupResult;
    } else {
      throw new Error(`Component setup() must return a render function`);
    }
  } finally {
    setCurrentInstance(null);
  }

  // Create mounted component
  mounted = {
    instance,
    props: normalizedProps,
    render,
    emitCallbacks,
    exposed: {},
    renderEffect: null,
    lastElement: null,
  };

  // Store in instances map
  component.instances.set(mountKey, mounted);

  // Mark as mounted and run mounted hooks
  instance.isMounted = true;
  invokeHooks(instance.mountedHooks);

  // Start tick timers
  startTickTimers(instance);

  return mounted;
}

/**
 * Unmounts a component and cleans up its instance.
 *
 * @internal
 * @param mounted - Mounted component to unmount
 */
export function unmountComponent(mounted: MountedComponent) {
  unmountInstance(mounted.instance);

  // Stop render effect
  if (mounted.renderEffect && mounted.renderEffect.effect) {
    mounted.renderEffect.effect.stop();
  }
}

/**
 * Renders a component and returns the view element.
 *
 * @internal
 * @param mounted - Mounted component
 * @returns View element
 */
export function renderComponent(mounted: MountedComponent): ViewElement {
  const { instance, render } = mounted;

  // Run before update hooks
  if (instance.isMounted) {
    invokeHooks(instance.beforeUpdateHooks);
  }

  // Render the component
  let element: ViewElement = render();

  mounted.lastElement = element;

  // Run updated hooks
  if (instance.isMounted) {
    invokeHooks(instance.updatedHooks);
  }

  return element;
}
/**
 * Handles key events for a component.
 * Returns true if the event was handled and should stop propagation.
 *
 * @internal
 * @param mounted - Mounted component
 * @param event - Key event
 * @returns True if event was handled
 */
export function handleComponentKey(mounted: MountedComponent, event: KeyEvent): boolean {
  return invokeKeyHooks(mounted.instance.keyHooks, event);
}

/**
 * Normalizes and validates props.
 *
 * @internal
 */
function normalizeProps(propOptions: Record<string, PropOptions>, rawProps: any): any {
  const normalized: any = {};

  for (const key in propOptions) {
    const option = propOptions[key];
    if (!option) continue;

    let value = rawProps[key];

    // Use default value if not provided
    if (value === undefined) {
      if (option.default !== undefined) {
        value = typeof option.default === "function" ? option.default() : option.default;
      }
    }

    // Check required
    if (option.required && value === undefined) {
      console.warn(`Prop "${key}" is required but not provided`);
    }

    // Validate
    if (option.validator && value !== undefined) {
      if (!option.validator(value)) {
        console.warn(`Prop "${key}" failed validation`);
      }
    }

    normalized[key] = value;
  }

  // Copy other props that aren't in options
  for (const key in rawProps) {
    if (!(key in normalized)) {
      normalized[key] = rawProps[key];
    }
  }

  return normalized;
}

/**
 * Helper to check if a value is a component
 */
export function isComponent(value: any): value is Component {
  return value && typeof value === "object" && "options" in value && "instances" in value;
}
