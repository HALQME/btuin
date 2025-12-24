import type { KeyEvent } from "../terminal/types/key-event";
import type { Component, ComponentInitContext, ExitReason, RuntimeContext } from "./core";
import { isBlock, type ViewElement } from "../view/types/elements";
import {
  createComponentInstance,
  invokeHooks,
  invokeKeyHooks,
  onKey,
  onMounted,
  onTick,
  onUnmounted,
  setCurrentInstance,
  startTickTimers,
  unmountInstance,
  type ComponentInstance,
} from "./lifecycle";

const INSTANCES = Symbol.for("btuin.component.instances");

export type { Component };

export type RenderFunction = () => ViewElement;

export type PropDefinition =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | ObjectConstructor
  | ArrayConstructor
  | FunctionConstructor
  | {
      type?: any;
      required?: boolean;
      default?: any;
      validator?: (value: any) => boolean;
    };

export type PropsOptions = Record<string, PropDefinition>;

export interface DefineComponentOptions<Props extends Record<string, any> = Record<string, any>> {
  name?: string;
  props?: PropsOptions;
  setup: (props: Props) => RenderFunction;
}

function isPlainRecord(value: unknown): value is Record<string, any> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function normalizeProps(options: PropsOptions | undefined, raw: unknown): Record<string, any> {
  const rawProps = isPlainRecord(raw) ? raw : {};
  if (!options) return { ...rawProps };

  const out: Record<string, any> = { ...rawProps };

  for (const [name, defRaw] of Object.entries(options)) {
    const def =
      typeof defRaw === "function"
        ? ({ type: defRaw } as const)
        : (defRaw as Exclude<PropDefinition, Function>);

    const hasValue = Object.prototype.hasOwnProperty.call(rawProps, name);
    let value = hasValue ? rawProps[name] : undefined;

    if (value === undefined) {
      if (def && typeof def === "object" && "default" in def && def.default !== undefined) {
        value = typeof def.default === "function" ? def.default() : def.default;
      }
    }

    if (
      def &&
      typeof def === "object" &&
      "required" in def &&
      def.required &&
      value === undefined
    ) {
      throw new Error(`Missing required prop: ${name}`);
    }

    if (
      def &&
      typeof def === "object" &&
      "validator" in def &&
      def.validator &&
      value !== undefined
    ) {
      if (!def.validator(value)) {
        throw new Error(`Invalid prop: ${name}`);
      }
    }

    out[name] = value;
  }

  return out;
}

export function defineComponent<Props extends Record<string, any> = Record<string, any>>(
  options: DefineComponentOptions<Props>,
): Component<{ render: RenderFunction }> & { options: DefineComponentOptions<Props> } {
  return {
    __type: "Component",
    options,
    init: (ctx: ComponentInitContext) => {
      const props = normalizeProps(options.props, (ctx as any).props);
      const render = options.setup(props as Props);
      return { render };
    },
    render: ({ render }) => render(),
  };
}

export interface MountedComponent {
  instance: ComponentInstance;
  render: () => ViewElement;
  renderEffect: any;
  lastElement: ViewElement | null;
}

function getInstanceStore<State>(component: Component<State>): WeakMap<any, MountedComponent> {
  const anyComponent = component as any;
  if (!anyComponent[INSTANCES]) {
    anyComponent[INSTANCES] = new WeakMap<any, MountedComponent>();
  }
  return anyComponent[INSTANCES] as WeakMap<any, MountedComponent>;
}

export function mountComponent<State>(
  component: Component<State>,
  keyOrProps?: any,
  runtime?: RuntimeContext,
): MountedComponent {
  if (!isComponent(component)) {
    throw new Error("mountComponent() expects a Component.");
  }

  const maybeOptions = (component as any).options as DefineComponentOptions | undefined;
  const treatSecondArgAsProps =
    runtime === undefined && !!maybeOptions?.props && isPlainRecord(keyOrProps);
  const mountKey = treatSecondArgAsProps ? Symbol() : (keyOrProps ?? Symbol());
  const rawProps = treatSecondArgAsProps ? keyOrProps : undefined;

  const store = getInstanceStore(component);
  const existing = store.get(mountKey);
  if (existing) return existing;

  const instance = createComponentInstance();
  const safeRuntime =
    runtime ??
    ({
      exit: () => {},
      getSize: () => ({ rows: 0, cols: 0 }),
      onResize: () => () => {},
      getEnv: () => undefined,
      onExit: (_handler) => () => {},
      setExitOutput: () => {},
    } satisfies RuntimeContext);

  const initContext: ComponentInitContext = {
    onKey: (fn) => onKey(fn),
    onTick: (fn, interval) => onTick(fn, interval),
    onMounted: (fn) => onMounted(fn),
    onUnmounted: (fn) => onUnmounted(fn),
    runtime: safeRuntime,
    cleanup: (fn) => {
      instance.effects.push(fn);
    },
    exit: (code, reason: ExitReason | undefined) => safeRuntime.exit(code, reason),
    getSize: () => safeRuntime.getSize(),
    onResize: (handler) => {
      instance.effects.push(safeRuntime.onResize(handler));
    },
    getEnv: (name) => safeRuntime.getEnv(name),
    onExit: (handler) => {
      instance.effects.push(safeRuntime.onExit(handler));
    },
    setExitOutput: (output) => safeRuntime.setExitOutput(output),
  };

  (initContext as any).props = rawProps;

  setCurrentInstance(instance);
  let state: any = undefined;
  try {
    state = component.init?.(initContext);
  } finally {
    setCurrentInstance(null);
  }

  const mounted: MountedComponent = {
    instance,
    render: () => component.render(state),
    renderEffect: null,
    lastElement: null,
  };

  store.set(mountKey, mounted);

  instance.isMounted = true;
  invokeHooks(instance.mountedHooks);
  startTickTimers(instance);

  return mounted;
}

export function unmountComponent(mounted: MountedComponent) {
  unmountInstance(mounted.instance);
  if (mounted.renderEffect && mounted.renderEffect.effect) {
    mounted.renderEffect.effect.stop();
  }
}

export function renderComponent(mounted: MountedComponent): ViewElement {
  const { instance, render } = mounted;

  if (instance.isMounted) {
    invokeHooks(instance.beforeUpdateHooks);
  }

  const element = render();
  mounted.lastElement = element;

  if (instance.isMounted) {
    invokeHooks(instance.updatedHooks);
  }

  return element;
}

export function handleComponentKey(mounted: MountedComponent, event: KeyEvent): boolean {
  if (mounted.lastElement) {
    const handled = traverseKeyHandlers(mounted.lastElement, (element) =>
      invokeKeyHooks(element.keyHooks, event),
    );
    if (handled) return true;
  }

  return invokeKeyHooks(mounted.instance.keyHooks, event);
}

function traverseKeyHandlers(
  element: ViewElement,
  visitor: (element: ViewElement) => boolean,
): boolean {
  if (isBlock(element)) {
    for (let i = element.children.length - 1; i >= 0; i--) {
      const child = element.children[i]!;
      if (traverseKeyHandlers(child, visitor)) {
        return true;
      }
    }
  }

  if (element.keyHooks.length > 0 && visitor(element)) {
    return true;
  }

  return false;
}

export function isComponent(value: any): value is Component<any> {
  return value && typeof value === "object" && value.__type === "Component";
}
