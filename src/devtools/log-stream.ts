import { getConsoleCaptureInstance, type ConsoleCaptureHandle } from "../terminal/capture";
import { createJsonlFileLogStreamer, createJsonlTcpLogStreamer, type LogStreamer } from "./stream";
import type { DevtoolsOptions } from "./types";

export interface DevtoolsLogStreaming {
  capture: ConsoleCaptureHandle | null;
  dispose(): void;
}

export function setupDevtoolsLogStreaming(
  options: DevtoolsOptions | undefined,
  onLine?: () => void,
): DevtoolsLogStreaming {
  const enabled = options?.enabled ?? false;
  if (!enabled) {
    return { capture: null, dispose: () => {} };
  }

  const capture = getConsoleCaptureInstance({ maxLines: options?.maxLogLines ?? 1000 });

  const streamers: LogStreamer[] = [];
  const filePath = options?.stream?.file;
  if (filePath) streamers.push(createJsonlFileLogStreamer(filePath));

  const tcp = options?.stream?.tcp;
  if (tcp) {
    streamers.push(
      createJsonlTcpLogStreamer({
        host: tcp.host,
        port: tcp.port,
        onListen: tcp.onListen,
        backlog: tcp.backlog,
      }),
    );
  }

  const cleanupSubscribe = capture.subscribe((line) => {
    onLine?.();
    for (const streamer of streamers) {
      try {
        streamer.writeLine(line);
      } catch {
        // ignore
      }
    }
  });

  return {
    capture,
    dispose: () => {
      try {
        cleanupSubscribe();
      } catch {
        // ignore
      }

      for (const streamer of streamers.splice(0)) {
        try {
          streamer.dispose();
        } catch {
          // ignore
        }
      }
    },
  };
}
