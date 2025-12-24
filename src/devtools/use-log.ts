import { shallowRef } from "../reactivity";
import type { Ref } from "../reactivity/ref";
import { getCurrentInstance } from "../components/lifecycle";
import {
  getConsoleCaptureInstance,
  type ConsoleCaptureHandle,
  type ConsoleLine,
} from "../terminal/capture";

export interface UseLogOptions {
  /**
   * Maximum number of lines stored in the shared console buffer.
   * Note: This is applied only when the singleton capture is first created.
   */
  maxLines?: number;

  /**
   * Include stdout lines.
   * @default true
   */
  stdout?: boolean;

  /**
   * Include stderr lines.
   * @default true
   */
  stderr?: boolean;
}

export interface UseLogResult {
  lines: Ref<ConsoleLine[]>;
  clear: () => void;
  dispose: () => void;
  capture: ConsoleCaptureHandle;
}

function filterLines(
  all: ConsoleLine[],
  options: { stdout: boolean; stderr: boolean },
): ConsoleLine[] {
  if (options.stdout && options.stderr) return all;
  if (options.stdout) return all.filter((l) => l.type === "stdout");
  if (options.stderr) return all.filter((l) => l.type === "stderr");
  return [];
}

/**
 * Reactive access to captured console output.
 *
 * Intended usage: call inside a component `init()` (auto-disposes on unmount).
 * If called outside a component init, call `dispose()` manually.
 */
export function useLog(options: UseLogOptions = {}): UseLogResult {
  const stdout = options.stdout ?? true;
  const stderr = options.stderr ?? true;

  const capture = getConsoleCaptureInstance({ maxLines: options.maxLines });
  const lines = shallowRef<ConsoleLine[]>(filterLines(capture.getLines(), { stdout, stderr }));

  const refresh = () => {
    lines.value = filterLines(capture.getLines(), { stdout, stderr });
  };

  const dispose = capture.subscribe(() => {
    refresh();
  });

  const instance = getCurrentInstance();
  if (instance) {
    instance.effects.push(dispose);
  }

  return {
    lines,
    clear: () => {
      capture.clear();
      refresh();
    },
    dispose,
    capture,
  };
}
