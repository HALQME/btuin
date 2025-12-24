import { watch, type FSWatcher } from "node:fs";

export interface HotReloadWatchOptions {
  /**
   * Paths to watch. Can be files or directories.
   */
  paths: string[];

  /**
   * Debounce file change events.
   * @default 50
   */
  debounceMs?: number;
}

export interface HotReloadTcpOptions {
  /**
   * Bind host.
   * @default "127.0.0.1"
   */
  host?: string;

  /**
   * Bind port. Use 0 to pick an ephemeral port.
   * @default 0
   */
  port?: number;

  /**
   * Called after the server starts listening (useful when `port: 0`).
   */
  onListen?: (info: { host: string; port: number }) => void;
}

export interface RunHotReloadProcessOptions {
  /**
   * Command to run your TUI entry (typically "bun").
   */
  command: string;

  /**
   * Command arguments (e.g. ["run", "examples/devtools.ts"]).
   */
  args?: string[];

  /**
   * Watch paths that trigger restarts.
   */
  watch: HotReloadWatchOptions;

  /**
   * Optional TCP reload server: send "reload\\n" (or JSONL {"type":"reload"}).
   */
  tcp?: HotReloadTcpOptions;

  /**
   * Working directory for the child process.
   * @default process.cwd()
   */
  cwd?: string;

  /**
   * Extra env vars for the child process.
   */
  env?: Record<string, string | undefined>;

  /**
   * Preserve state across restarts (opt-in from the app via `enableHotReloadState`).
   * @default true
   */
  preserveState?: boolean;

  /**
   * Signal used when restarting the child.
   * @default "SIGTERM"
   */
  restartSignal?: NodeJS.Signals;

  /**
   * Force-kill timeout when restarting.
   * @default 1500
   */
  restartTimeoutMs?: number;
}

export interface HotReloadProcessHandle {
  /**
   * Restart the child process.
   */
  restart(): Promise<void>;
  /**
   * Stop watchers, stop TCP server, and terminate the child process.
   */
  close(): Promise<void>;
  /**
   * Get whether a child is currently running.
   */
  isRunning(): boolean;
}

type TcpReloadMessage = "reload" | { type: "reload" };
type HotReloadIpcMessage =
  | { type: "btuin:hot-reload:request-snapshot" }
  | { type: "btuin:hot-reload:snapshot"; snapshot: unknown };

const SNAPSHOT_ENV_KEY = "BTUIN_HOT_RELOAD_SNAPSHOT";

function parseTcpReloadMessage(line: string): TcpReloadMessage | null {
  const trimmed = line.trim();
  if (trimmed === "reload") return "reload";

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "type" in parsed &&
      (parsed as any).type === "reload"
    ) {
      return { type: "reload" };
    }
  } catch {
    // ignore
  }
  return null;
}

function encodeSnapshot(snapshot: unknown): string | null {
  try {
    return Buffer.from(JSON.stringify(snapshot), "utf8").toString("base64");
  } catch {
    return null;
  }
}

function createDebouncedCallback(cb: () => void, debounceMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      cb();
    }, debounceMs);
  };
}

function createWatchers(watchOptions: HotReloadWatchOptions, onChange: () => void): () => void {
  const debounceMs = watchOptions.debounceMs ?? 50;
  const trigger = createDebouncedCallback(onChange, debounceMs);

  const watchers: FSWatcher[] = [];
  for (const p of watchOptions.paths) {
    try {
      watchers.push(watch(p, { recursive: true }, trigger));
    } catch {
      try {
        watchers.push(watch(p, trigger));
      } catch {
        // ignore
      }
    }
  }

  return () => {
    for (const w of watchers.splice(0)) {
      try {
        w.close();
      } catch {
        // ignore
      }
    }
  };
}

export interface TcpReloadServerHandle {
  close(): Promise<void>;
}

export function createTcpReloadServer(
  options: HotReloadTcpOptions,
  onReload: () => void,
): TcpReloadServerHandle {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;

  let listener: Bun.TCPSocketListener<{ buf: string }> | null = null;
  try {
    listener = Bun.listen({
      hostname: host,
      port,
      data: { buf: "" },
      socket: {
        open(socket) {
          socket.data = { buf: "" };
        },
        data(socket, data) {
          const chunk = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
          socket.data.buf += chunk;
          for (;;) {
            const idx = socket.data.buf.indexOf("\n");
            if (idx < 0) break;
            const line = socket.data.buf.slice(0, idx);
            socket.data.buf = socket.data.buf.slice(idx + 1);
            const msg = parseTcpReloadMessage(line);
            if (msg) onReload();
          }
        },
        error() {
          // ignore
        },
        close() {
          // ignore
        },
      },
    });

    try {
      options.onListen?.({ host: listener.hostname, port: listener.port });
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }

  return {
    close: () =>
      new Promise((resolve) => {
        try {
          listener?.stop(true);
          resolve();
        } catch {
          resolve();
        }
      }),
  };
}

async function stopChild(
  child: ReturnType<typeof Bun.spawn> | null,
  signal: NodeJS.Signals,
  timeoutMs: number,
): Promise<void> {
  if (!child) return;

  try {
    child.kill(signal);
  } catch {
    // ignore
  }

  const didExit = await Promise.race([
    child.exited.then(() => true).catch(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ]);

  if (!didExit) {
    try {
      child.kill("SIGKILL");
    } catch {
      // ignore
    }
    await child.exited.catch(() => {});
  }
}

export function runHotReloadProcess(options: RunHotReloadProcessOptions): HotReloadProcessHandle {
  const cmd = [options.command, ...(options.args ?? [])];
  const restartSignal = options.restartSignal ?? "SIGTERM";
  const restartTimeoutMs = options.restartTimeoutMs ?? 1500;
  const preserveState = options.preserveState ?? true;

  let closing = false;
  let restarting = false;
  let child: ReturnType<typeof Bun.spawn> | null = null;
  let disposeWatchers: (() => void) | null = null;
  let tcpServer: TcpReloadServerHandle | null = null;
  let lastSnapshot: unknown = null;
  let snapshotWaiter: ((snapshot: unknown) => void) | null = null;

  const close = async () => {
    if (closing) return;
    closing = true;

    process.off("SIGINT", onSigint);

    disposeWatchers?.();
    disposeWatchers = null;

    await tcpServer?.close();
    tcpServer = null;

    await stopChild(child, restartSignal, restartTimeoutMs);
    child = null;
  };

  const restart = async () => {
    if (closing) return;
    if (restarting) return;
    restarting = true;

    if (preserveState && child && typeof (child as any).send === "function") {
      try {
        const p = new Promise<unknown>((resolve) => {
          snapshotWaiter = resolve;
        });
        (child as any).send({
          type: "btuin:hot-reload:request-snapshot",
        } satisfies HotReloadIpcMessage);
        const snapshot = await Promise.race([
          p,
          new Promise<unknown>((resolve) => setTimeout(() => resolve(null), 200)),
        ]);
        if (snapshot !== null) lastSnapshot = snapshot;
      } catch {
        // ignore
      } finally {
        snapshotWaiter = null;
      }
    }

    const prev = child;
    child = null;
    await stopChild(prev, restartSignal, restartTimeoutMs);
    restarting = false;
    start();
  };

  const onSigint = () => void close().finally(() => process.exit(0));
  process.once("SIGINT", onSigint);

  const start = () => {
    if (closing) return;

    const env: Record<string, string> = { ...process.env } as Record<string, string>;
    if (options.env) {
      for (const [key, value] of Object.entries(options.env)) {
        if (value === undefined) {
          delete env[key];
        } else {
          env[key] = value;
        }
      }
    }

    if (preserveState && lastSnapshot !== null) {
      const encoded = encodeSnapshot(lastSnapshot);
      if (encoded) env[SNAPSHOT_ENV_KEY] = encoded;
    }

    child = Bun.spawn({
      cmd,
      cwd: options.cwd ?? process.cwd(),
      env,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
      serialization: "json",
      ipc: (message) => {
        const m = message as HotReloadIpcMessage;
        if (
          m &&
          typeof m === "object" &&
          "type" in m &&
          (m as any).type === "btuin:hot-reload:snapshot"
        ) {
          snapshotWaiter?.((m as any).snapshot);
        }
      },
    });

    child.exited
      .then((code) => {
        if (closing) return;
        if (restarting) return;
        void close().finally(() => process.exit(code ?? 0));
      })
      .catch(() => {
        if (closing) return;
        if (restarting) return;
        void close().finally(() => process.exit(1));
      });
  };

  disposeWatchers = createWatchers(options.watch, () => void restart());
  tcpServer = options.tcp ? createTcpReloadServer(options.tcp, () => void restart()) : null;

  start();

  return {
    restart,
    close,
    isRunning: () => child !== null,
  };
}
