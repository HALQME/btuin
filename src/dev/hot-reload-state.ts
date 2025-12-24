type HotReloadIpcMessage =
  | { type: "btuin:hot-reload:request-snapshot" }
  | { type: "btuin:hot-reload:snapshot"; snapshot: unknown };

const SNAPSHOT_ENV_KEY = "BTUIN_HOT_RELOAD_SNAPSHOT";

function decodeSnapshot(encoded: string): unknown | null {
  try {
    const json = Buffer.from(encoded, "base64").toString("utf8");
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}

export interface EnableHotReloadStateOptions {
  /**
   * Create a JSON-serializable snapshot of your app state.
   * This will be requested by the hot-reload runner before restart.
   */
  getSnapshot: () => unknown;

  /**
   * Restore from a previous snapshot (if present).
   * Called once when this helper is first invoked.
   */
  applySnapshot?: (snapshot: unknown) => void;
}

let current: EnableHotReloadStateOptions | null = null;
let appliedEnvSnapshot = false;
let messageHandlerRegistered = false;

/**
 * Opt-in helper to preserve state across process restarts when using `btuin dev`.
 *
 * How it works:
 * - The runner requests a snapshot via Bun IPC before restarting the process.
 * - The runner passes the snapshot to the next process via `BTUIN_HOT_RELOAD_SNAPSHOT`.
 */
export function enableHotReloadState(options: EnableHotReloadStateOptions) {
  current = options;

  if (!appliedEnvSnapshot && options.applySnapshot) {
    const encoded = process.env[SNAPSHOT_ENV_KEY];
    if (encoded) {
      const snapshot = decodeSnapshot(encoded);
      if (snapshot !== null) {
        try {
          options.applySnapshot(snapshot);
        } catch {
          // ignore
        }
      }
    }
    appliedEnvSnapshot = true;
  }

  const maybeSend = (process as any).send as undefined | ((msg: HotReloadIpcMessage) => void);
  if (!maybeSend) return;

  if (messageHandlerRegistered) return;
  messageHandlerRegistered = true;

  process.on("message", (message: any) => {
    const m = message as HotReloadIpcMessage;
    if (!m || typeof m !== "object" || !("type" in m)) return;
    if ((m as any).type !== "btuin:hot-reload:request-snapshot") return;
    if (!current) return;

    try {
      maybeSend({ type: "btuin:hot-reload:snapshot", snapshot: current.getSnapshot() });
    } catch {
      // ignore
    }
  });
}
