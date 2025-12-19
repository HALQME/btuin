import type { KeyEvent } from "@/terminal";
import { stop } from "@/reactivity";
import { Block } from "@/view/primitives";
import { handleComponentKey, renderComponent } from "@/view/components";
import { createRenderer } from "./render-loop";
import { createErrorContext, createErrorHandler } from "./error-boundary";
import type { AppContext } from "./context";
import type { ViewElement } from "@/view/types/elements";
import type { ILoopManager } from "./types";

export class LoopManager implements ILoopManager {
  private ctx: AppContext;
  private handleError: ReturnType<typeof createErrorHandler>;

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
    });

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
            terminal.clearScreen();
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
    if (state.disposeResize) {
      state.disposeResize();
      updaters.disposeResize(null);
    }
  }
}
