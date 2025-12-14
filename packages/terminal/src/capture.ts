/**
 * Output Capture Utility
 *
 * Patches process.stdout.write and process.stderr.write to intercept
 * console output without interfering with the TUI rendering system.
 */

type OutputListener = (text: string) => void;

type WriteFunction = (chunk: any, encoding?: any, callback?: any) => boolean;

interface CaptureState {
  isCapturing: boolean;
  stdoutListeners: Set<OutputListener>;
  stderrListeners: Set<OutputListener>;
  originalStdoutWrite: WriteFunction | null;
  originalStderrWrite: WriteFunction | null;
  testModeEnabled: boolean;
  capturedOutput: string[];
}

const state: CaptureState = {
  isCapturing: false,
  stdoutListeners: new Set(),
  stderrListeners: new Set(),
  originalStdoutWrite: null,
  originalStderrWrite: null,
  testModeEnabled: false,
  capturedOutput: [],
};

function createStreamProxy<T extends { write: WriteFunction }>(
  target: T,
  writeFn: WriteFunction,
): T {
  const proxy = Object.create(target) as T;
  proxy.write = function (chunk: any, encoding?: any, callback?: any) {
    return writeFn.call(target, chunk, encoding, callback);
  };
  return proxy;
}

/**
 * Start capturing stdout and stderr.
 * Previous write functions are saved to restore later.
 */
export function startCapture(): void {
  if (state.isCapturing) return;

  // Save original write functions if not already saved
  if (!state.originalStdoutWrite) {
    state.originalStdoutWrite = process.stdout.write;
  }
  if (!state.originalStderrWrite) {
    state.originalStderrWrite = process.stderr.write;
  }

  // Patch stdout
  process.stdout.write = ((chunk: any, ..._args: any[]): boolean => {
    const text = typeof chunk === "string" ? chunk : chunk.toString();

    // Notify all stdout listeners
    for (const listener of state.stdoutListeners) {
      try {
        listener(text);
      } catch {
        // Silently ignore listener errors to prevent cascading failures
      }
    }

    // Don't write to actual stdout to prevent UI interference
    return true;
  }) as WriteFunction;

  // Patch stderr
  process.stderr.write = ((chunk: any, ..._args: any[]): boolean => {
    const text = typeof chunk === "string" ? chunk : chunk.toString();

    // Notify all stderr listeners
    for (const listener of state.stderrListeners) {
      try {
        listener(text);
      } catch {
        // Silently ignore listener errors
      }
    }

    // Don't write to actual stderr to prevent UI interference
    return true;
  }) as WriteFunction;

  state.isCapturing = true;
}

/**
 * Stop capturing and restore original stdout/stderr.
 */
export function stopCapture(): void {
  if (!state.isCapturing) return;

  // Restore original methods
  if (state.originalStdoutWrite) {
    process.stdout.write = state.originalStdoutWrite;
    state.originalStdoutWrite = null;
  }

  if (state.originalStderrWrite) {
    process.stderr.write = state.originalStderrWrite;
    state.originalStderrWrite = null;
  }

  state.isCapturing = false;
}

/**
 * Add a listener for stdout output.
 * Returns a cleanup function to remove the listener.
 */
export function onStdout(listener: OutputListener): () => void {
  state.stdoutListeners.add(listener);

  // Start capturing if not already started
  if (!state.isCapturing) {
    startCapture();
  }

  return () => {
    state.stdoutListeners.delete(listener);

    // Stop capturing if no more listeners
    if (state.stdoutListeners.size === 0 && state.stderrListeners.size === 0) {
      stopCapture();
    }
  };
}

/**
 * Add a listener for stderr output.
 * Returns a cleanup function to remove the listener.
 */
export function onStderr(listener: OutputListener): () => void {
  state.stderrListeners.add(listener);

  // Start capturing if not already started
  if (!state.isCapturing) {
    startCapture();
  }

  return () => {
    state.stderrListeners.delete(listener);

    // Stop capturing if no more listeners
    if (state.stdoutListeners.size === 0 && state.stderrListeners.size === 0) {
      stopCapture();
    }
  };
}

/**
 * Check if output is currently being captured.
 */
export function isCapturing(): boolean {
  return state.isCapturing;
}

/**
 * Get the original stdout write function for TUI rendering.
 * This allows the TUI to output directly to the terminal without being captured.
 * In test mode, captures output for verification.
 */
export function getOriginalStdout(): typeof process.stdout {
  const captureWrite: WriteFunction = (chunk: any, ..._args: any[]): boolean => {
    const text = typeof chunk === "string" ? chunk : chunk.toString();
    state.capturedOutput.push(text);
    return true;
  };

  if (state.testModeEnabled) {
    return createStreamProxy(process.stdout, captureWrite);
  }

  if (state.isCapturing && state.originalStdoutWrite) {
    return createStreamProxy(process.stdout, state.originalStdoutWrite);
  }

  return process.stdout;
}

/**
 * Get the original stderr write function.
 * This allows error output directly to the terminal without being captured.
 */
export function getOriginalStderr(): typeof process.stderr {
  if (state.isCapturing && state.originalStderrWrite) {
    return createStreamProxy(process.stderr, state.originalStderrWrite);
  }
  return process.stderr;
}

/**
 * Patch console methods to route through stdout/stderr.
 * This ensures console.log, console.error, etc. are captured.
 */
export function patchConsole(): () => void {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  const originalDebug = console.debug;

  console.log = (...args: any[]) => {
    const text = args.map(String).join(" ") + "\n";
    process.stdout.write(text);
  };

  console.error = (...args: any[]) => {
    const text = args.map(String).join(" ") + "\n";
    process.stderr.write(text);
  };

  console.warn = (...args: any[]) => {
    const text = "[WARN] " + args.map(String).join(" ") + "\n";
    process.stderr.write(text);
  };

  console.info = (...args: any[]) => {
    const text = "[INFO] " + args.map(String).join(" ") + "\n";
    process.stdout.write(text);
  };

  console.debug = (...args: any[]) => {
    const text = "[DEBUG] " + args.map(String).join(" ") + "\n";
    process.stdout.write(text);
  };

  return () => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    console.info = originalInfo;
    console.debug = originalDebug;
  };
}

/**
 * Enable test mode: captures all stdout/stderr output for verification.
 */
export function enableTestMode(): void {
  state.testModeEnabled = true;
  state.capturedOutput = [];
  startCapture();
}

/**
 * Disable test mode and return captured output.
 */
export function disableTestMode(): string {
  state.testModeEnabled = false;
  stopCapture();
  return state.capturedOutput.join("");
}

/**
 * Get all captured output in test mode.
 */
export function getCapturedOutput(): string {
  return state.capturedOutput.join("");
}

/**
 * Clear captured output buffer.
 */
export function clearCapturedOutput(): void {
  state.capturedOutput = [];
}
