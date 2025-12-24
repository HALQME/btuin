import type { KeyEvent } from "../terminal/types/key-event";
import { stop } from "../reactivity";
import { handleComponentKey, renderComponent } from "../components";
import { createInlineDiffRenderer } from "../renderer";
import { layout } from "../layout";
import { Block } from "../view/primitives";
import type { ViewElement } from "../view/types/elements";
import { createRenderer } from "./render-loop";
import { createErrorContext, createErrorHandler } from "./error-boundary";
import type { AppContext } from "./context";
import type { ILoopManager } from "./types";

export class LoopManager implements ILoopManager {
  private ctx: AppContext;
  private handleError: ReturnType<typeof createErrorHandler>;
  private cleanupTerminalFn: (() => void) | null = null;
  private cleanupOutputListeners: (() => void)[] = [];

  constructor(context: AppContext, handleError: ReturnType<typeof createErrorHandler>) {
    this.ctx = context;
    this.handleError = handleError;
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
        return renderComponent(state.mounted);
      },
      getState: () => ({}),
      handleError: this.handleError,
      profiler: profiler.isEnabled() ? profiler : undefined,
      deps: inline
        ? {
            renderDiff: inline.renderDiff,
            layout: (root, containerSize) => layout(root, containerSize, { inline: true }),
          }
        : undefined,
    });

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
          renderer.renderOnce(false);
        });
      };

      const clearUiOnce = () => {
        if (uiSuspended) return;
        uiSuspended = true;
        const seq = inline.cleanup();
        if (seq) terminal.write(seq);
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

    renderer.renderOnce(true);
    updaters.renderEffect(renderer.render());

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
            renderer.renderOnce(true);
          } catch (error) {
            this.handleError(createErrorContext("resize", error));
          }
        }),
      );
    }
  }

  stop() {
    const { state, updaters } = this.ctx;
    if (state.renderEffect) {
      stop(state.renderEffect);
      updaters.renderEffect(null);
    }
    if (this.cleanupOutputListeners.length > 0) {
      for (const dispose of this.cleanupOutputListeners.splice(0)) {
        try {
          dispose();
        } catch {
          // ignore
        }
      }
    }
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
