/**
 * App Creation and Mounting System
 *
 * Vue-like app creation and mounting for btuin TUI framework.
 */

import type { KeyEvent } from "@btuin/terminal";
import type { ViewElement } from "../view/types/elements";
import { initLayoutEngine } from "../layout";
import {
  setupRawMode,
  clearScreen,
  cleanupWithoutClear,
  patchConsole,
  startCapture,
  onKey as terminalOnKey,
  getTerminalSize,
  disposeSingletonCapture,
} from "@btuin/terminal";
import {
  defineComponent,
  mountComponent,
  unmountComponent,
  renderComponent,
  handleComponentKey,
  type Component,
  type MountedComponent,
} from "../components";
import { effect, stop, type ReactiveEffect } from "@btuin/reactivity";
import { createRenderer } from "./render-loop";
import { createErrorHandler, createErrorContext } from "./error-boundary";

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

  // Convert config to component definition
  const rootComponent = defineComponent({
    name: "App",
    setup: config.setup,
  });

  const appInstance: AppInstance = {
      async mount(options: MountOptions = {}) { // asyncに変更
        if (isMounted) {
          console.warn("App is already mounted");
          return appInstance;
        }

        // Wasmレイアウトエンジンの初期化待機
        await initLayoutEngine();

      const rows = options.rows ?? 0;
      const cols = options.cols ?? 0;

      // Patch console to prevent output interference
      patchConsole();
      startCapture();

      // Setup terminal
      setupRawMode();
      clearScreen();

      // Terminal size resolver
      const getSize = () => {
        const termSize = getTerminalSize();
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

      try {
        // Mount root component
        mounted = mountComponent(rootComponent, {});

        // Create renderer once
        const renderer = createRenderer({
          getSize,
          view: () => {
            if (!mounted) return { type: "paragraph", text: "" } as ViewElement;
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

        // Setup keyboard event handler
        terminalOnKey((event: KeyEvent) => {
          if (!mounted) return;

          try {
            // Handle component key events
            handleComponentKey(mounted, event);
          } catch (error) {
            handleError(createErrorContext("key", error, { keyEvent: event }));
          }
        });

        // Setup resize handler if auto-sizing
        if (rows === 0 || cols === 0) {
          process.stdout.on("resize", () => {
            try {
              clearScreen();
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

        process.once("exit", exitHandler);
        process.once("SIGINT", () => {
          exitHandler();
          process.exit(0);
        });
        process.once("SIGTERM", () => {
          exitHandler();
          process.exit(0);
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
        disposeSingletonCapture();

        // Clean up terminal
        cleanupWithoutClear();

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
