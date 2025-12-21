import type { KeyEvent } from "@/terminal";
import type { ViewElement } from "@/view/types/elements";

export type KeyHandler = (key: KeyEvent) => void | boolean;
export type TickHandler = () => void;

export type ExitReason = "normal" | "sigint" | "sigterm";

export interface RuntimeContext {
  exit: (code?: number, reason?: ExitReason) => void;
  getSize: () => { rows: number; cols: number };
  onResize: (handler: () => void) => () => void;
  getEnv: (name: string) => string | undefined;
  onExit: (handler: (info: { code: number; reason: ExitReason }) => void) => () => void;
  setExitOutput: (output: string | (() => string)) => void;
}

export interface ComponentInitContext {
  onKey: (fn: KeyHandler) => void;
  onTick: (fn: TickHandler, interval?: number) => void;
  onMounted: (fn: () => void) => void;
  onUnmounted: (fn: () => void) => void;
  runtime: RuntimeContext;
  cleanup: (fn: () => void) => void;
  exit: (code?: number, reason?: ExitReason) => void;
  getSize: () => { rows: number; cols: number };
  onResize: (handler: () => void) => void;
  getEnv: (name: string) => string | undefined;
  onExit: (handler: (info: { code: number; reason: ExitReason }) => void) => void;
  setExitOutput: (output: string | (() => string)) => void;
}

export interface Component<State = unknown> {
  __type: "Component";
  init?: (ctx: ComponentInitContext) => State;
  render: (state: State) => ViewElement;
}

export type ComponentDefinition<State> = {
  init?: (ctx: ComponentInitContext) => State;
  render: (state: State) => ViewElement;
};

type AssertSync<T> = T extends PromiseLike<any> ? never : T;

/**
 * Defines a reusable core Component.
 *
 * This only defines a component. Nothing is executed until a Runtime mounts it.
 */
export function createComponent(
  definition: Omit<ComponentDefinition<void>, "init"> & { init?: undefined },
): Component<void>;
export function createComponent<Init extends (ctx: ComponentInitContext) => any>(
  definition: AssertSync<ReturnType<Init>> extends never
    ? never
    : {
        init: Init;
        render: (state: ReturnType<Init>) => ViewElement;
      },
): Component<ReturnType<Init>>;
export function createComponent<State>(definition: ComponentDefinition<State>): Component<State> {
  return {
    __type: "Component",
    init: definition.init,
    render: definition.render,
  };
}
