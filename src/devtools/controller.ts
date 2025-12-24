import type { KeyEvent } from "../terminal/types/key-event";
import type { ConsoleCaptureHandle } from "../terminal/capture";
import { setupDevtoolsLogStreaming } from "./log-stream";
import type { DevtoolsOptions } from "./types";
import { setupDevtoolsServer, type DevtoolsSnapshot } from "./server";

export interface DevtoolsController {
  handleKey(event: KeyEvent): boolean;
  wrapView(
    root: import("../view/types/elements").ViewElement,
  ): import("../view/types/elements").ViewElement;
  onLayout?(snapshot: DevtoolsSnapshot): void;
  dispose(): void;
}

export function createDevtoolsController(options: DevtoolsOptions | undefined): DevtoolsController {
  const enabled = options?.enabled ?? false;

  const streaming = setupDevtoolsLogStreaming(options);

  const capture: ConsoleCaptureHandle | null = enabled ? streaming.capture : null;
  const server = enabled ? setupDevtoolsServer(options, () => capture) : null;

  return {
    handleKey: (event) => {
      void event;
      return false;
    },

    wrapView: (root) => root,

    onLayout: (snapshot) => {
      server?.setSnapshot(snapshot);
    },

    dispose: () => {
      try {
        server?.dispose();
      } catch {
        // ignore
      }
      streaming.dispose();
    },
  };
}
