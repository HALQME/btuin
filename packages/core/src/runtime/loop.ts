import type { KeyEvent } from "../terminal/types/key-event";
import { stop } from "../reactivity";
import { handleComponentKey, renderComponent } from "../components";
import { invokeKeyHooks } from "../components/lifecycle";
import { createInlineDiffRenderer } from "../renderer";
import { collectFocusTargets, focusManager, layout } from "../layout";
import { Block } from "../view/primitives";
import type { ViewElement } from "../view/types/elements";
import { createRenderer } from "./render-loop";
import { createErrorContext, createErrorHandler } from "./error-boundary";
import type { AppContext } from "./context";
import type { ILoopManager } from "./types";
import type { AppPlugin } from "./plugin";

export class LoopManager implements ILoopManager {
  private ctx: AppContext;
  private handleError: ReturnType<typeof createErrorHandler>;
  private plugins: AppPlugin[];
  private cleanupTerminalFn: (() => void) | null = null;
  private cleanupOutputListeners: (() => void)[] = [];
  private cleanupProfilerListeners: (() => void)[] = [];

  constructor(
    context: AppContext,
    handleError: ReturnType<typeof createErrorHandler>,
    plugins: AppPlugin[],
  ) {
    this.ctx = context;
    this.handleError = handleError;
    this.plugins = plugins;
  }

  start(rows: number, cols: number) {
    const { state, updaters, terminal, platform, profiler, app } = this.ctx;

    const getSize = () => {
      const termSize = terminal.getTerminalSize();
      return {
        rows: rows === 0 ? termSize.rows : rows,
        cols: cols === 0 ? termSize.cols : cols,
      };
    };

    const pendingKeyEvents: KeyEvent[] = [];

    terminal.onKey((event: KeyEvent) => {
      if (!state.mounted) {
        pendingKeyEvents.push(event);
        return;
      }

      try {
        for (const plugin of this.plugins) {
          if (plugin.handleKey?.(event)) return;
        }

        if (focusManager.enabled.value) {
          if (event.name === "tab") {
            if (event.shift) {
              focusManager.previous();
            } else {
              focusManager.next();
            }
            return;
          }
        }

        const activeTarget = focusManager.getActiveTarget();
        if (activeTarget?.element.keyHooks.length) {
          if (invokeKeyHooks(activeTarget.element.keyHooks, event)) {
            return;
          }
        }

        const handled = handleComponentKey(state.mounted, event);
        if (!handled && (event.sequence === "\x03" || (event.ctrl && event.name === "c"))) {
          app.exit(0, "sigint");
        }
      } catch (error) {
        this.handleError(createErrorContext("key", error, { keyEvent: event }));
      }
    });

    const inline =
      state.renderMode === "inline"
        ? (() => {
            const inline = createInlineDiffRenderer();
            this.cleanupTerminalFn = () => {
              const seq = inline.cleanup();
              if (seq) terminal.write(seq);
            };
            return inline;
          })()
        : null;

    const renderer = createRenderer({
      getSize,
      write: terminal.write,
      view: (): ViewElement => {
        if (!state.mounted) return Block();
        let root = renderComponent(state.mounted);
        for (const plugin of this.plugins) {
          root = plugin.wrapView?.(root) ?? root;
        }
        return root;
      },
      getState: () => ({}),
      onLayout: ({ size, rootElement, layoutMap }) => {
        focusManager.setTargets(collectFocusTargets(rootElement, layoutMap));
        for (const plugin of this.plugins) {
          try {
            plugin.onLayout?.({
              size,
              rootElement,
              layoutMap,
            });
          } catch (e) {
            console.error(`[btuin] error in plugin '${plugin.name}' onLayout hook:`, e);
          }
        }
      },
      handleError: this.handleError,
      profiler: profiler.isEnabled() ? profiler : undefined,
      deps: inline
        ? {
            renderDiff: inline.renderDiff,
            layout: (root, containerSize) => layout(root, containerSize, { inline: true }),
          }
        : undefined,
    });

    focusManager.enabled.value = true;

    if (inline) {
      let uiSuspended = false;
      let rerenderScheduled = false;

      const scheduleRerenderAfterOutput = () => {
        if (rerenderScheduled) return;
        rerenderScheduled = true;
        queueMicrotask(() => {
          rerenderScheduled = false;
          if (!state.isMounted || state.isUnmounting) return;
          if (state.renderMode !== "inline") return;
          uiSuspended = false;
          renderer.requestRender({ immediate: true });
        });
      };

      const clearUiOnce = () => {
        if (uiSuspended) return;
        uiSuspended = true;
        const seq = inline.cleanup();
        if (seq) terminal.write(seq);
        renderer.invalidate();
      };

      if (terminal.onStdout && terminal.writeStdout) {
        this.cleanupOutputListeners.push(
          terminal.onStdout((text) => {
            if (!state.isMounted || state.isUnmounting) return;
            if (state.renderMode !== "inline") return;
            clearUiOnce();
            terminal.writeStdout?.(text);
            scheduleRerenderAfterOutput();
          }),
        );
      }
      if (terminal.onStderr && terminal.writeStderr) {
        this.cleanupOutputListeners.push(
          terminal.onStderr((text) => {
            if (!state.isMounted || state.isUnmounting) return;
            if (state.renderMode !== "inline") return;
            clearUiOnce();
            terminal.writeStderr?.(text);
            scheduleRerenderAfterOutput();
          }),
        );
      }
    }

    updaters.renderEffect(renderer.render({ forceFullRedraw: true }));
    if (state.renderEffect && state.mounted) {
      state.renderEffect.meta = {
        type: "render",
        componentId: state.mounted.instance.uid,
        componentName: state.mounted.instance.name,
      };
    }

    if (profiler.isEnabled()) {
      const cleanup = profiler.subscribeFrames((frame) => {
        for (const plugin of this.plugins) {
          try {
            plugin.onProfileFrame?.(frame);
          } catch (e) {
            console.error(`[btuin] error in plugin '${plugin.name}' onProfileFrame hook:`, e);
          }
        }
      });
      this.cleanupProfilerListeners.push(cleanup);
    }

    if (pendingKeyEvents.length && state.mounted) {
      for (const event of pendingKeyEvents.splice(0)) {
        try {
          handleComponentKey(state.mounted, event);
        } catch (error) {
          this.handleError(createErrorContext("key", error, { keyEvent: event }));
        }
      }
    }

    if (rows === 0 || cols === 0) {
      updaters.disposeResize(
        platform.onStdoutResize(() => {
          try {
            if (state.renderMode !== "inline") {
              terminal.clearScreen();
            }
            renderer.requestRender({ forceFullRedraw: true });
          } catch (error) {
            this.handleError(createErrorContext("resize", error));
          }
        }),
      );
    }
  }

  stop() {
    focusManager.enabled.value = false;
    const { state, updaters } = this.ctx;
    if (state.renderEffect) {
      stop(state.renderEffect);
      updaters.renderEffect(null);
    }

    for (const dispose of this.cleanupOutputListeners.splice(0)) {
      try {
        dispose();
      } catch (e) {
        console.error("[btuin] error during output listener cleanup:", e);
      }
    }
    for (const dispose of this.cleanupProfilerListeners.splice(0)) {
      try {
        dispose();
      } catch (e) {
        console.error("[btuin] error during profiler listener cleanup:", e);
      }
    }

    for (const plugin of this.plugins) {
      try {
        plugin.dispose?.();
      } catch (e) {
        console.error(`[btuin] error disposing plugin '${plugin.name}':`, e);
      }
    }
    this.plugins = [];

    if (state.disposeResize) {
      state.disposeResize();
      updaters.disposeResize(null);
    }
  }

  cleanupTerminal() {
    this.cleanupTerminalFn?.();
    this.cleanupTerminalFn = null;
  }
}
