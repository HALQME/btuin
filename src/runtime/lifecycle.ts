import type { ExitReason } from "@/components/core";
import { unmountComponent } from "@/components";
import type { AppContext } from "./context";

export class LifecycleManager {
  private ctx: AppContext;

  constructor(context: AppContext) {
    this.ctx = context;
  }

  unmount = () => {
    const { state, updaters, terminal, profiler, options, loopManager } = this.ctx;
    if (!state.isMounted || state.isUnmounting) return;

    updaters.isUnmounting(true);
    try {
      options.onExit?.();

      loopManager.stop();
      if (state.renderMode === "inline" && state.inlineCleanupOnExit) {
        loopManager.cleanupTerminal?.();
      }

      if (state.mounted) {
        unmountComponent(state.mounted);
        updaters.mounted(null);
      }

      terminal.stopCapture();
      if (state.unpatchConsole) {
        state.unpatchConsole();
        updaters.unpatchConsole(null);
      }
      terminal.disposeSingletonCapture();
      profiler.flushSync();
      terminal.setBracketedPaste?.(false);
      terminal.cleanupWithoutClear();

      updaters.isMounted(false);
    } finally {
      updaters.isUnmounting(false);
      updaters.processHasActiveMount(false);
      updaters.renderMode("fullscreen");
      updaters.inlineCleanupOnExit(false);
    }
  };

  exit = (code = 0, reason: ExitReason = "normal") => {
    const { state, updaters, terminal, platform, app } = this.ctx;
    if (state.isUnmounting || state.isExiting) return;
    updaters.isExiting(true);

    const renderModeAtExit = state.renderMode;

    for (const handler of state.exitHandlers) {
      try {
        handler({ code, reason });
      } catch {
        // ignore
      }
    }

    // This will call the unmount method on the App instance
    app.unmount();

    let output: string | null = null;
    if (reason === "normal") {
      try {
        output = typeof state.exitOutput === "function" ? state.exitOutput() : state.exitOutput;
      } catch {
        output = null;
      }
    }

    if (renderModeAtExit !== "inline") {
      const { rows } = terminal.getTerminalSize();
      terminal.moveCursor(rows, 1);
      terminal.write("\n");
      terminal.clearScreen();
    }
    if (output) {
      process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
    }

    platform.exit(code);
    updaters.isExiting(false);
  };
}
