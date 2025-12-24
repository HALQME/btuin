import { mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import type { ConsoleLine } from "../terminal/capture";

export interface LogStreamer {
  writeLine(line: ConsoleLine): void;
  dispose(): void;
}

function ensureParentDir(filePath: string) {
  const dir = path.dirname(filePath);
  mkdirSync(dir, { recursive: true });
}

/**
 * Streams console lines to a file as JSONL (newline-delimited JSON).
 */
export function createJsonlFileLogStreamer(filePath: string): LogStreamer {
  ensureParentDir(filePath);

  return {
    writeLine: (line) => {
      const payload = JSON.stringify(line);
      appendFileSync(filePath, payload + "\n", "utf8");
    },
    dispose: () => {},
  };
}

/**
 * Streams console lines to connected TCP clients as JSONL.
 */
export function createJsonlTcpLogStreamer(options?: {
  host?: string;
  port?: number;
  onListen?: (info: { host: string; port: number }) => void;
  backlog?: number;
}): LogStreamer {
  const host = options?.host ?? "127.0.0.1";
  const port = options?.port ?? 0;
  const backlogLimit = Math.max(0, options?.backlog ?? 200);

  const sockets = new Set<Bun.Socket<any>>();
  const backlog: string[] = [];

  let listener: Bun.TCPSocketListener | null = null;
  try {
    listener = Bun.listen({
      hostname: host,
      port,
      data: undefined,
      socket: {
        open(socket) {
          sockets.add(socket);

          if (backlogLimit > 0 && backlog.length > 0) {
            for (const payload of backlog) {
              try {
                socket.write(payload);
              } catch {
                // ignore
              }
            }
          }
        },
        close(socket) {
          sockets.delete(socket);
        },
        error(socket) {
          sockets.delete(socket);
          try {
            socket.end();
          } catch {
            // ignore
          }
        },
      },
    });

    try {
      options?.onListen?.({ host: listener.hostname, port: listener.port });
    } catch {
      // ignore
    }
  } catch {
    // ignore server errors to avoid crashing the app
  }

  return {
    writeLine: (line) => {
      const payload = JSON.stringify(line) + "\n";
      if (backlogLimit > 0) {
        backlog.push(payload);
        if (backlog.length > backlogLimit) {
          backlog.splice(0, backlog.length - backlogLimit);
        }
      }

      if (sockets.size === 0) return;
      for (const socket of sockets) {
        try {
          socket.write(payload);
        } catch {
          sockets.delete(socket);
          try {
            socket.end();
          } catch {
            // ignore
          }
        }
      }
    },
    dispose: () => {
      for (const socket of sockets) {
        try {
          socket.end();
        } catch {
          // ignore
        }
      }
      sockets.clear();
      backlog.length = 0;
      try {
        listener?.stop(true);
      } catch {
        // ignore
      }
    },
  };
}
