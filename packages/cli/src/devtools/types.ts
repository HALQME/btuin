export interface DevtoolsOptions {
  /**
   * Enable built-in DevTools.
   *
   * Note: DevTools does not render an in-TUI panel.
   * @default false
   */
  enabled?: boolean;

  /**
   * Maximum number of log lines kept in memory.
   * @default 1000
   */
  maxLogLines?: number;

  /**
   * Stream logs outside the TUI (no external window opened).
   * Useful for `tail -f` or piping into other tools.
   */
  stream?: {
    /**
     * Append console lines as JSONL (one JSON object per line).
     * Example: `tail -f /tmp/btuin-devtools.log | jq -r .text`
     */
    file?: string;

    /**
     * Stream console lines as JSONL over TCP.
     * Designed for local debugging: connect with `nc 127.0.0.1 <port>`.
     */
    tcp?: {
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

      /**
       * Number of most recent log lines to keep and flush to newly connected clients.
       * Helps avoid missing logs around connect timing.
       * @default 200
       */
      backlog?: number;
    };
  };

  /**
   * Start a local browser DevTools server.
   * Serves a tiny UI + WebSocket event stream (logs + snapshots).
   */
  server?: {
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
    onListen?: (info: { host: string; port: number; url: string }) => void;
  };
}
