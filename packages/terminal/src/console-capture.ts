/**
 * Console Capture Helper
 *
 * Provides state-based console output management that integrates with btuin's
 * application state system. Unlike the element-based approach, this allows
 * console output to be stored in application state and trigger re-renders.
 */

import { onStdout, onStderr } from "./capture";

export interface ConsoleLine {
  text: string;
  type: "stdout" | "stderr";
  timestamp: number;
}

export interface ConsoleCaptureHandle {
  /**
   * Get all captured lines.
   */
  getLines(): ConsoleLine[];

  /**
   * Get only stdout lines.
   */
  getStdoutLines(): ConsoleLine[];

  /**
   * Get only stderr lines.
   */
  getStderrLines(): ConsoleLine[];

  /**
   * Clear all captured lines.
   */
  clear(): void;

  /**
   * Stop capturing and clean up listeners.
   */
  dispose(): void;
}

/**
 * Create a console capture handle that stores output in memory.
 *
 * @param options Configuration options
 * @returns A handle to access and manage captured output
 *
 * @example
 * ```typescript
 * const capture = createConsoleCapture({ maxLines: 100 });
 * const lines = capture.getLines();
 * ```
 */
export function createConsoleCapture(options?: { maxLines?: number }): ConsoleCaptureHandle {
  const maxLines = options?.maxLines ?? 1000;
  const lines: ConsoleLine[] = [];

  // Capture stdout
  const cleanupStdout = onStdout((text) => {
    const textLines = text.split("\n");
    for (const line of textLines) {
      if (line) {
        lines.push({
          text: line,
          type: "stdout",
          timestamp: Date.now(),
        });

        // Limit buffer size
        if (lines.length > maxLines) {
          lines.shift();
        }
      }
    }
  });

  // Capture stderr
  const cleanupStderr = onStderr((text) => {
    const textLines = text.split("\n");
    for (const line of textLines) {
      if (line) {
        lines.push({
          text: line,
          type: "stderr",
          timestamp: Date.now(),
        });

        // Limit buffer size
        if (lines.length > maxLines) {
          lines.shift();
        }
      }
    }
  });

  return {
    getLines: () => [...lines],

    getStdoutLines: () => lines.filter((l) => l.type === "stdout"),

    getStderrLines: () => lines.filter((l) => l.type === "stderr"),

    clear: () => {
      lines.length = 0;
    },

    dispose: () => {
      cleanupStdout();
      cleanupStderr();
      lines.length = 0;
    },
  };
}

/**
 * Render captured console lines as ViewElements.
 *
 * @param lines Array of console lines to render
 * @param options Rendering options
 * @returns Array of ViewElements (Paragraph elements)
 *
 * @example
 * ```typescript
 * view: (state) => ({
 *   type: "vstack",
 *   children: [
 *     // Main UI
 *     ...mainUI,
 *     // Console output
 *     ...renderConsoleOutput(state.consoleLines, {
 *       maxLines: 10,
 *       showStdout: true,
 *       showStderr: true,
 *     }),
 *   ],
 * })
 * ```
 */
export function renderConsoleOutput(
  lines: ConsoleLine[],
  options?: {
    maxLines?: number;
    showStdout?: boolean;
    showStderr?: boolean;
  },
): Array<{ type: "paragraph"; text: string; color?: string }> {
  const maxLines = options?.maxLines ?? 20;
  const showStdout = options?.showStdout ?? true;
  const showStderr = options?.showStderr ?? true;

  // Filter by type
  let filtered = lines;
  if (!showStdout) {
    filtered = filtered.filter((l) => l.type !== "stdout");
  }
  if (!showStderr) {
    filtered = filtered.filter((l) => l.type !== "stderr");
  }

  // Take last N lines
  const visible = filtered.slice(-maxLines);

  // Convert to ViewElements
  return visible.map((line) => ({
    type: "paragraph" as const,
    text: line.text,
    color: line.type === "stderr" ? "red" : undefined,
  }));
}

/**
 * Singleton console capture instance.
 * Lazily initialized on first access.
 */
let singletonCapture: ConsoleCaptureHandle | null = null;

/**
 * Get or create the singleton console capture instance.
 * This ensures only one capture instance exists throughout the application.
 *
 * @param options Configuration options (only used on first call)
 * @returns The singleton console capture handle
 */
export function getConsoleCaptureInstance(options?: { maxLines?: number }): ConsoleCaptureHandle {
  if (!singletonCapture) {
    singletonCapture = createConsoleCapture(options);
  }
  return singletonCapture;
}

/**
 * Dispose the singleton console capture instance.
 * Stops capturing and frees resources.
 */
export function disposeSingletonCapture(): void {
  if (singletonCapture) {
    singletonCapture.dispose();
    singletonCapture = null;
  }
}
