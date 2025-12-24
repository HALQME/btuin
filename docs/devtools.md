# DevTools

btuin includes a lightweight DevTools layer focused on observability during TUI development.

- Browser DevTools (local server + WebSocket)
- Stream logs externally (file / TCP) so you can `tail -f` or `nc` from another terminal

## Enable

Enable DevTools via `createApp({ devtools: ... })`:

```ts
import { createApp, ui } from "btuin";

const app = createApp({
  devtools: { enabled: true },
  init: () => ({}),
  render: () => ui.Text("Hello"),
});
```

## Browser DevTools (recommended)

Start the local DevTools server:

```ts
import { createApp, ui } from "btuin";

const app = createApp({
  devtools: {
    enabled: true,
    server: {
      host: "127.0.0.1",
      port: 0,
      onListen: ({ url }) => console.log(`[devtools] open ${url}`),
    },
  },
  init: () => ({}),
  render: () => ui.Text("Hello"),
});
```

Open the printed URL in your browser. It shows logs and a snapshot stream.

The Snapshot view includes a simple **Preview** (layout boxes + text) and a **JSON** view (raw snapshot payload).

## `useLog()` hook

`useLog()` exposes captured console output as reactive state (useful for building your own log UI).

Options:

- `devtools.maxLogLines` (default: `1000`)

```ts
import { defineComponent, useLog, ui } from "btuin";

export const LogView = defineComponent({
  setup() {
    const log = useLog();
    return () => ui.Text(`lines: ${log.lines.value.length}`);
  },
});
```

Notes:

- Intended to be called inside component `init()`/`setup()` (auto-disposed on unmount).
- If you call it outside component initialization, call `dispose()` yourself.

## Stream logs to a file (JSONL)

Append each captured line as JSONL:

```ts
devtools: {
  enabled: true,
  stream: { file: "/tmp/btuin-devtools.log" },
}
```

Example:

```bash
tail -f /tmp/btuin-devtools.log | jq -r '.type + " " + .text'
```

Format (one line per event):

```json
{ "text": "hello", "type": "stdout", "timestamp": 1730000000000 }
```

## Stream logs over TCP (JSONL)

Start a local TCP server and stream JSONL to connected clients:

```ts
devtools: {
  enabled: true,
  stream: {
    tcp: {
      host: "127.0.0.1",
      port: 9229,
      backlog: 200,
      onListen: ({ host, port }) => console.log(`DevTools TCP: ${host}:${port}`),
    },
  },
}
```

Connect from another terminal:

```bash
nc 127.0.0.1 9229 | jq -r '.type + " " + .text'
```

Backlog:

- `backlog` is the number of most recent log lines kept in memory and flushed to new clients.
- This helps avoid missing logs around connect timing.

Security notes:

- Bind to `127.0.0.1` unless you explicitly want remote access.
- Do not expose the port publicly unless you accept leaking stdout/stderr content.

# Hot Reload (Dev Runner)

`btuin` treats raw terminal input handling as a process-wide singleton. Because of that, doing a true in-process “remount” loop (HMR-style) would accumulate key handlers and lead to duplicated input events.

Instead, the recommended development workflow is to **restart the app process** on changes (hot reload as a dev runner). It simply re-runs your TUI in the same terminal.

## CLI

```bash
btuin dev <entry> [options] [-- <args...>]
```

Examples:

```bash
btuin dev examples/devtools.ts
btuin dev src/main.ts --watch src --watch examples
btuin dev src/main.ts -- --foo bar
```

Options:

- `--watch <path>` (repeatable)
- `--debounce <ms>` (default: `50`)
- `--cwd <path>` (default: `process.cwd()`)
- `--no-preserve-state` (default: preserve enabled)
- `--no-tcp` (disable TCP reload trigger)
- `--tcp-host <host>` (default: `127.0.0.1`)
- `--tcp-port <port>` (default: `0`)

## Preserve state across restarts

Use `enableHotReloadState()` in your app to opt into state preservation.

Disable state preservation:

```bash
btuin dev examples/devtools.ts --no-preserve-state
```

Or create a small runner script:

```ts
import { runHotReloadProcess } from "btuin";

runHotReloadProcess({
  command: "bun",
  args: ["examples/devtools.ts"],
  watch: { paths: ["src", "examples"] },
});
```

Run it:

```bash
bun run examples/hot-reload.ts
```

## TCP Trigger (Optional)

`btuin dev` enables TCP by default (ephemeral port). You can also configure it in code:

```ts
import { runHotReloadProcess } from "btuin";

runHotReloadProcess({
  command: "bun",
  args: ["examples/devtools.ts"],
  watch: { paths: ["src", "examples"] },
  tcp: {
    host: "127.0.0.1",
    port: 0,
    onListen: ({ host, port }) => {
      process.stderr.write(`[btuin] hot-reload tcp: ${host}:${port}\n`);
    },
  },
});
```

Trigger reload from another terminal:

```bash
printf 'reload\n' | nc 127.0.0.1 <port>
```

Or JSONL:

```bash
printf '{"type":"reload"}\n' | nc 127.0.0.1 <port>
```

## Preserving State (Opt-in)

Because the runner restarts the process, in-memory state resets by default.

If you want to preserve state across restarts, opt in from your app:

```ts
import { enableHotReloadState, ref } from "btuin";

const count = ref(0);

enableHotReloadState({
  getSnapshot: () => ({ count: count.value }),
  applySnapshot: (snapshot) => {
    if (!snapshot || typeof snapshot !== "object") return;
    const maybe = (snapshot as any).count;
    if (typeof maybe === "number") count.value = maybe;
  },
});
```
