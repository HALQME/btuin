import type { KeyEvent } from "@/terminal";
import { effect } from "@/reactivity";
import type { Component, ComponentInitContext } from "@/component";
import { Block } from "@/view/primitives";
import type { ViewElement } from "@/view/types/elements";
import {
  handleComponentKey,
  mountComponent,
  renderComponent,
} from "@/view/components";
import { createRenderer } from "./render-loop";
import { createErrorContext, createErrorHandler } from "./error-boundary";
import { createDefaultTerminalAdapter } from "./terminal-adapter";
import { createDefaultPlatformAdapter, type PlatformAdapter } from "./platform-adapter";
import { Profiler } from "./profiler";
import { LifecycleManager } from "./lifecycle";
import { LoopManager } from "./loop";
import type { AppContext } from "./context";
import type { App, AppConfig, CreateAppOptions, MountOptions } from "./types";

let processHasActiveMount = false;

export function App<State>(root: Component<State>, options: CreateAppOptions = {}): App {
  const state: AppContext["state"] = {
    mounted: null,
    renderEffect: null,
    isMounted: false,
    isUnmounting: false,
    disposeResize: null,
    unpatchConsole: null,
    exitHandlers: new Set(),
    exitOutput: null,
    isExiting: false,
    processHasActiveMount: false,
  };

  const updaters: AppContext["updaters"] = {
    mounted: (m) => (state.mounted = m),
    renderEffect: (e) => (state.renderEffect = e),
    isMounted: (v) => (state.isMounted = v),
    isUnmounting: (v) => (state.isUnmounting = v),
    disposeResize: (d) => (state.disposeResize = d),
    unpatchConsole: (u) => (state.unpatchConsole = u),
    isExiting: (v) => (state.isExiting = v),
    processHasActiveMount: (v) => (processHasActiveMount = v),
  };

  const terminal = options.terminal ?? createDefaultTerminalAdapter();
  const platform = options.platform ?? createDefaultPlatformAdapter();
  const profiler = new Profiler(options.profile ?? {});

  const context: AppContext = {
    app: null as any, // will be set below
    state,
    updaters,
    terminal,
    platform,
    profiler,
    options,
    loopManager: null as any, // will be set below
  };

  const lifecycleManager = new LifecycleManager(context);

  const app: App = {
    mount,
    unmount: lifecycleManager.unmount,
    exit: lifecycleManager.exit,
    getSize: () => terminal.getTerminalSize(),
    onResize: (handler) => platform.onStdoutResize(handler),
    getEnv: (name) => platform.getEnv?.(name),
    onExit: (handler) => {
      state.exitHandlers.add(handler);
      return () => state.exitHandlers.delete(handler);
    },
    setExitOutput: (output) => {
      state.exitOutput = output;
    },
    getComponent: () => state.mounted,
  };

  context.app = app;

  async function mount(mountOptions: MountOptions = {}) {
    if (state.isMounted) return;

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

      context.loopManager = new LoopManager(context, handleError);

      const rows = mountOptions.rows ?? 0;
      const cols = mountOptions.cols ?? 0;

      updaters.unpatchConsole(terminal.patchConsole());
      terminal.startCapture();
      terminal.setupRawMode();
      terminal.clearScreen();

      updaters.mounted(
        mountComponent(root, undefined, {
          exit: (code = 0, reason = "normal") => app.exit(code, reason),
          getSize: () => terminal.getTerminalSize(),
          onResize: (handler) => platform.onStdoutResize(handler),
          getEnv: (name) => platform.getEnv?.(name),
          onExit: (handler) => {
            state.exitHandlers.add(handler);
            return () => state.exitHandlers.delete(handler);
          },
          setExitOutput: (output) => {
            state.exitOutput = output;
          },
        }),
      );

      context.loopManager.start(rows, cols);

      updaters.isMounted(true);

      const exitHandler = () => {
        if (state.isUnmounting) return;
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
      if (!state.isMounted && state.disposeResize) {
        state.disposeResize();
        updaters.disposeResize(null);
      }
      if (!state.isMounted) {
        try {
          terminal.stopCapture();
        } catch {
          // ignore
        }
        try {
          state.unpatchConsole?.();
        } catch {
          // ignore
        }
        updaters.unpatchConsole(null);
      }
      if (!state.isMounted) {
        processHasActiveMount = false;
      }
    }
  }

  return app;
}

function normalizePlatformAdapter(
  platform?: Partial<PlatformAdapter>,
): PlatformAdapter | undefined {
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
    inputParser: config.inputParser,
  });
}

export const createApp = app;
