import type { KeyEvent } from "@btuin/terminal";
import { Block } from "../view/primitives";
import { initLayoutEngine } from "../layout";
import {
  defineComponent,
  mountComponent,
  unmountComponent,
  renderComponent,
  handleComponentKey,
  type Component,
  type MountedComponent,
} from "../view/components";
import { effect, stop, type ReactiveEffect } from "@btuin/reactivity";
import { createRenderer } from "./render-loop";
import { createErrorHandler, createErrorContext } from "./error-boundary";
import { createDefaultTerminalAdapter, type TerminalAdapter } from "./terminal-adapter";
import { createDefaultPlatformAdapter, type PlatformAdapter } from "./platform-adapter";

export interface AppConfig {
  /**
   * Setup function where component logic is defined.
   * Returns a render function that produces the view.
   *
   * @example
   * ```typescript
   * setup() {
   *   const count = ref(0);
   *
   *   onKey((key) => {
   *     if (key.name === 'up') count.value++;
   *   });
   *
   *   return () => Paragraph({ text: `Count: ${count.value}` });
   * }
   * ```
   */
  setup: Component["options"]["setup"];

  /**
   * Optional error handler for the app.
   * Called when errors occur during rendering or lifecycle.
   */
  onError?: (error: Error, phase: string) => void;

  /**
   * Optional file path for logging errors.
   */
  errorLog?: string;

  /**
   * Optional handler called when the app is about to exit.
   */
  onExit?: () => void;

  /**
   * Optional terminal adapter (for tests/custom IO).
   */
  terminal?: TerminalAdapter;

  /**
   * Optional platform adapter (process hooks/exit).
   */
  platform?: PlatformAdapter;
}

export interface AppInstance {
  /**
   * Mounts the app to the terminal.
   *
   * @param options - Mount options
   * @returns Promise<AppInstance> for chaining
   */
  mount(options?: MountOptions): Promise<AppInstance>;

  /**
   * Unmounts the app and cleans up resources.
   */
  unmount(): void;

  /**
   * Gets the root component instance.
   */
  getComponent(): MountedComponent | null;
}

export interface MountOptions {
  /**
   * Number of rows in the terminal display.
   * Set to 0 for auto-sizing based on terminal.
   * @default 0
   */
  rows?: number;

  /**
   * Number of columns in the terminal display.
   * Set to 0 for auto-sizing based on terminal.
   * @default 0
   */
  cols?: number;
}

/**
 * Creates a btuin TUI application.
 *
 * @example
 * ```typescript
 * import { createApp, ref, onKey, Paragraph } from 'btuin';
 *
 * const app = createApp({
 *   setup() {
 *     const count = ref(0);
 *
 *     onKey((key) => {
 *       if (key.name === 'up') count.value++;
 *       if (key.name === 'q') process.exit(0);
 *     });
 *
 *     return () => Paragraph({
 *       text: `Count: ${count.value}`,
 *       align: 'center'
 *     });
 *   }
 * });
 *
 * app.mount();
 * ```
 *
 * @param config - Application configuration
 * @returns App instance
 */
export function createApp(config: AppConfig): AppInstance {
  let mounted: MountedComponent | null = null;
  let renderEffect: ReactiveEffect | null = null;
  let isMounted = false;
  let isUnmounting = false;
  const term = config.terminal ?? createDefaultTerminalAdapter();
  const platform = config.platform ?? createDefaultPlatformAdapter();

  // Convert config to component definition
  const rootComponent = defineComponent({
    name: "App",
    setup: config.setup,
  });

  const appInstance: AppInstance = {
    async mount(options: MountOptions = {}) {
      // asyncに変更
      if (isMounted) {
        console.warn("App is already mounted");
        return appInstance;
      }

      // Wasmレイアウトエンジンの初期化待機
      await initLayoutEngine();

      const rows = options.rows ?? 0;
      const cols = options.cols ?? 0;

      // Patch console to prevent output interference
      term.patchConsole();
      term.startCapture();

      // Setup terminal
      term.setupRawMode();
      term.clearScreen();

      // Terminal size resolver
      const getSize = () => {
        const termSize = term.getTerminalSize();
        return {
          rows: rows === 0 ? termSize.rows : rows,
          cols: cols === 0 ? termSize.cols : cols,
        };
      };

      // Error handler
      const handleError = createErrorHandler(
        config.onError
          ? (context) => {
              config.onError!(context.error, context.phase);
            }
          : undefined,
        config.errorLog,
      );

      // Buffer key events that may arrive before the app finishes mounting.
      const pendingKeyEvents: KeyEvent[] = [];

      // Setup keyboard event handler early to avoid losing initial input.
      term.onKey((event: KeyEvent) => {
        if (!mounted) {
          pendingKeyEvents.push(event);
          return;
        }

        try {
          handleComponentKey(mounted, event);
        } catch (error) {
          handleError(createErrorContext("key", error, { keyEvent: event }));
        }
      });

      try {
        // Mount root component
        mounted = mountComponent(rootComponent, {});

        // Create renderer once
        const renderer = createRenderer({
          getSize,
          write: term.write,
          view: () => {
            if (!mounted) return Block();
            return renderComponent(mounted);
          },
          getState: () => ({}),
          handleError,
        });

        // Create reactive render effect
        renderEffect = effect(() => {
          if (!mounted) return;

          try {
            renderer.render();
          } catch (error) {
            handleError(createErrorContext("render", error));
          }
        });

        // Flush any key events received during mount.
        if (pendingKeyEvents.length && mounted) {
          for (const event of pendingKeyEvents.splice(0)) {
            try {
              handleComponentKey(mounted, event);
            } catch (error) {
              handleError(createErrorContext("key", error, { keyEvent: event }));
            }
          }
          // Ensure a render after applying buffered events.
          renderEffect.run();
        }

        // Setup resize handler if auto-sizing
        if (rows === 0 || cols === 0) {
          platform.onStdoutResize(() => {
            try {
              term.clearScreen();
              if (renderEffect) {
                renderEffect.run();
              }
            } catch (error) {
              handleError(createErrorContext("resize", error));
            }
          });
        }

        isMounted = true;

        // Setup exit handler
        const exitHandler = () => {
          if (isUnmounting) return;
          appInstance.unmount();
        };

        platform.onExit(exitHandler);
        platform.onSigint(() => {
          exitHandler();
          platform.exit(0);
        });
        platform.onSigterm(() => {
          exitHandler();
          platform.exit(0);
        });
      } catch (error) {
        handleError(createErrorContext("mount", error));
      }

      return appInstance;
    },

    unmount() {
      if (!isMounted || isUnmounting) {
        return;
      }

      isUnmounting = true;

      try {
        // Call onExit handler
        if (config.onExit) {
          config.onExit();
        }

        // Stop render effect
        if (renderEffect) {
          stop(renderEffect);
          renderEffect = null;
        }

        // Unmount component
        if (mounted) {
          unmountComponent(mounted);
          mounted = null;
        }

        // Dispose console capture
        term.disposeSingletonCapture();

        // Clean up terminal
        term.cleanupWithoutClear();

        isMounted = false;
      } catch (error) {
        console.error("Error during unmount:", error);
      } finally {
        isUnmounting = false;
      }
    },

    getComponent() {
      return mounted;
    },
  };

  return appInstance;
}
