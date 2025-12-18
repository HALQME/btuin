import type { KeyEvent } from "../terminal";
import { effect, stop, type ReactiveEffect } from "../reactivity";
import type { Component, ComponentInitContext, ExitReason } from "../component";
import { initLayoutEngine } from "@/layout";
import { Block } from "@/view/primitives";
import type { ViewElement } from "@/view/types/elements";
import {
  handleComponentKey,
  mountComponent,
  renderComponent,
  unmountComponent,
  type MountedComponent,
} from "../view/components";
import { createRenderer } from "./render-loop";
import { createErrorContext, createErrorHandler } from "./error-boundary";
import { createDefaultTerminalAdapter, type TerminalAdapter } from "./terminal-adapter";
import { createDefaultPlatformAdapter, type PlatformAdapter } from "./platform-adapter";
import { Profiler, type ProfileOptions } from "./profiler";

export interface App {
  mount(options?: MountOptions): Promise<void>;
  unmount(): void;
  exit(code?: number, reason?: ExitReason): void;
  getSize(): { rows: number; cols: number };
  onResize(handler: () => void): () => void;
  getEnv(name: string): string | undefined;
  onExit(handler: (info: { code: number; reason: ExitReason }) => void): () => void;
  setExitOutput(output: string | (() => string)): void;
  getComponent(): MountedComponent | null;
}

export interface MountOptions {
  rows?: number;
  cols?: number;
}

export type CreateAppOptions = {
  onError?: (error: Error, phase: string) => void;
  errorLog?: string;
  onExit?: () => void;
  terminal?: TerminalAdapter;
  platform?: PlatformAdapter;
  profile?: ProfileOptions;
};

let processHasActiveMount = false;

export function App<State>(root: Component<State>, options: CreateAppOptions = {}): App {
  let mounted: MountedComponent | null = null;
  let renderEffect: ReactiveEffect | null = null;
  let isMounted = false;
  let isUnmounting = false;
  let disposeResize: (() => void) | null = null;
  let unpatchConsole: (() => void) | null = null;
  const exitHandlers = new Set<(info: { code: number; reason: ExitReason }) => void>();
  let exitOutput: string | (() => string) | null = null;
  let isExiting = false;

  const terminal = options.terminal ?? createDefaultTerminalAdapter();
  const platform = options.platform ?? createDefaultPlatformAdapter();
  const profiler = new Profiler(options.profile ?? {});

  const mount = async (mountOptions: MountOptions = {}) => {
    if (isMounted) return;

    if (processHasActiveMount) {
      throw new Error("Only one app may be mounted at a time per process.");
    }
    processHasActiveMount = true;

    let handleError: ReturnType<typeof createErrorHandler> = (context) => {
      const message = context.error.stack ?? context.error.message;
      process.stderr.write(`[btuin] error(${context.phase}): ${message}\n`);
    };

    try {
      handleError = createErrorHandler(
        options.onError ? (context) => options.onError?.(context.error, context.phase) : undefined,
        options.errorLog,
      );

      await initLayoutEngine();

      const rows = mountOptions.rows ?? 0;
      const cols = mountOptions.cols ?? 0;

      unpatchConsole = terminal.patchConsole();
      terminal.startCapture();
      terminal.setupRawMode();
      terminal.clearScreen();

      const getSize = () => {
        const termSize = terminal.getTerminalSize();
        return {
          rows: rows === 0 ? termSize.rows : rows,
          cols: cols === 0 ? termSize.cols : cols,
        };
      };

      const pendingKeyEvents: KeyEvent[] = [];

      terminal.onKey((event: KeyEvent) => {
        if (!mounted) {
          pendingKeyEvents.push(event);
          return;
        }

        try {
          const handled = handleComponentKey(mounted, event);
          if (!handled && (event.sequence === "\x03" || (event.ctrl && event.name === "c"))) {
            app.exit(0, "sigint");
          }
        } catch (error) {
          handleError(createErrorContext("key", error, { keyEvent: event }));
        }
      });

      mounted = mountComponent(root, undefined, {
        exit: (code = 0, reason = "normal") => app.exit(code, reason),
        getSize: () => terminal.getTerminalSize(),
        onResize: (handler) => platform.onStdoutResize(handler),
        getEnv: (name) => platform.getEnv?.(name),
        onExit: (handler) => {
          exitHandlers.add(handler);
          return () => exitHandlers.delete(handler);
        },
        setExitOutput: (output) => {
          exitOutput = output;
        },
      });

      const renderer = createRenderer({
        getSize,
        write: terminal.write,
        view: (): ViewElement => {
          if (!mounted) return Block();
          return renderComponent(mounted);
        },
        getState: () => ({}),
        handleError,
        profiler: profiler.isEnabled() ? profiler : undefined,
      });

      renderEffect = effect(() => {
        if (!mounted) return;
        try {
          renderer.render();
        } catch (error) {
          handleError(createErrorContext("render", error));
        }
      });

      renderer.render(true);

      if (pendingKeyEvents.length && mounted) {
        for (const event of pendingKeyEvents.splice(0)) {
          try {
            handleComponentKey(mounted, event);
          } catch (error) {
            handleError(createErrorContext("key", error, { keyEvent: event }));
          }
        }
        renderEffect.run();
      }

      if (rows === 0 || cols === 0) {
        disposeResize = platform.onStdoutResize(() => {
          try {
            terminal.clearScreen();
            renderEffect?.run();
          } catch (error) {
            handleError(createErrorContext("resize", error));
          }
        });
      }

      isMounted = true;

      const exitHandler = () => {
        if (isUnmounting) return;
        app.unmount();
      };

      platform.onExit(exitHandler);
      platform.onSigint(() => {
        app.exit(0, "sigint");
      });
      platform.onSigterm(() => {
        app.exit(0, "sigterm");
      });
    } catch (error) {
      handleError(createErrorContext("mount", error));
    } finally {
      if (!isMounted && disposeResize) {
        disposeResize();
        disposeResize = null;
      }
      if (!isMounted) {
        try {
          terminal.stopCapture();
        } catch {
          // ignore
        }
        try {
          unpatchConsole?.();
        } catch {
          // ignore
        }
        unpatchConsole = null;
      }
      if (!isMounted) {
        processHasActiveMount = false;
      }
    }
  };

  const unmount = () => {
    if (!isMounted || isUnmounting) return;

    isUnmounting = true;
    try {
      options.onExit?.();

      if (renderEffect) {
        stop(renderEffect);
        renderEffect = null;
      }

      if (mounted) {
        unmountComponent(mounted);
        mounted = null;
      }

      if (disposeResize) {
        disposeResize();
        disposeResize = null;
      }

      terminal.stopCapture();
      if (unpatchConsole) {
        unpatchConsole();
        unpatchConsole = null;
      }
      terminal.disposeSingletonCapture();
      profiler.flushSync();
      terminal.cleanupWithoutClear();

      isMounted = false;
    } finally {
      isUnmounting = false;
      processHasActiveMount = false;
    }
  };

  const exit = (code = 0, reason: ExitReason = "normal") => {
    if (isUnmounting || isExiting) return;
    isExiting = true;

    for (const handler of exitHandlers) {
      try {
        handler({ code, reason });
      } catch {
        // ignore
      }
    }

    app.unmount();

    let output: string | null = null;
    if (reason === "normal") {
      try {
        output = typeof exitOutput === "function" ? exitOutput() : exitOutput;
      } catch {
        output = null;
      }
    }

    const { rows } = terminal.getTerminalSize();
    terminal.moveCursor(rows, 1);
    terminal.write("\n");
    terminal.clearScreen();
    if (output) {
      terminal.write(output.endsWith("\n") ? output : `${output}\n`);
    }

    platform.exit(code);
    isExiting = false;
  };

  const getSize = () => terminal.getTerminalSize();

  const onResize = (handler: () => void) => platform.onStdoutResize(handler);
  const getEnv = (name: string) => platform.getEnv?.(name);
  const onExit = (handler: (info: { code: number; reason: ExitReason }) => void) => {
    exitHandlers.add(handler);
    return () => exitHandlers.delete(handler);
  };
  const setExitOutput = (output: string | (() => string)) => {
    exitOutput = output;
  };

  const getComponent = () => mounted;

  const app: App = {
    mount,
    unmount,
    exit,
    getSize,
    onResize,
    getEnv,
    onExit,
    setExitOutput,
    getComponent,
  };
  return app;
}

export type AppConfig<State> = {
  platform?: Partial<PlatformAdapter>;
  terminal?: TerminalAdapter;
  onError?: (error: Error, phase: string) => void;
  errorLog?: string;
  onExit?: () => void;
  profile?: ProfileOptions;
  init: (ctx: ComponentInitContext) => State;
  render: (state: State) => ViewElement;
};

function normalizePlatformAdapter(platform?: Partial<PlatformAdapter>): PlatformAdapter | undefined {
  if (!platform) return undefined;
  return {
    onStdoutResize: (handler) => {
      const maybeDispose = platform.onStdoutResize?.(handler);
      return typeof maybeDispose === "function" ? maybeDispose : () => {};
    },
    onExit: (handler) => platform.onExit?.(handler) ?? undefined,
    onSigint: (handler) => platform.onSigint?.(handler) ?? undefined,
    onSigterm: (handler) => platform.onSigterm?.(handler) ?? undefined,
    exit: (code) => (platform.exit ? platform.exit(code) : process.exit(code)),
    getEnv: (name) => platform.getEnv?.(name),
  } satisfies PlatformAdapter;
}

/**
 * Back-compat helper that accepts `init/render` and returns an `App` instance.
 */
export function app<Init extends (ctx: ComponentInitContext) => any>(
  config: Omit<AppConfig<ReturnType<Init>>, "init" | "render"> & {
    init: Init;
    render: (state: ReturnType<Init>) => ViewElement;
  },
): App {
  const root: Component<ReturnType<Init>> = {
    __type: "Component",
    init: config.init,
    render: config.render,
  };

  return App(root, {
    terminal: config.terminal,
    platform: normalizePlatformAdapter(config.platform) ?? undefined,
    onError: config.onError,
    errorLog: config.errorLog,
    onExit: config.onExit,
    profile: config.profile,
  });
}

export const createApp = app;
