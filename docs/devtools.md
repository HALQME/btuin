# DevTools

btuin includes a lightweight browser UI for observing your app during TUI development.

## Browser DevTools (recommended)

If you use the dev runner (`btuin dev ...`), browser DevTools is auto-enabled (disable with `--no-devtools`).
The runner also auto-opens the DevTools URL in your browser (disable with `--no-open-browser`).

Open the printed URL in your browser. It shows logs and a snapshot stream.

The Snapshot view includes a simple **Preview** (layout boxes + text) and a **JSON** view (raw snapshot payload).

You can also enable it without code by setting env vars:

- `BTUIN_DEVTOOLS=1` (enable)
- `BTUIN_DEVTOOLS_HOST` / `BTUIN_DEVTOOLS_PORT` (optional)
- `BTUIN_DEVTOOLS_CONTROLLER` (optional; module spec/path for the controller)

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
- `--no-tcp` (disable TCP reload trigger)
- `--tcp-host <host>` (default: `127.0.0.1`)
- `--tcp-port <port>` (default: `0`)

## TCP Trigger (Optional)

`btuin dev` enables TCP by default (ephemeral port).

Trigger reload from another terminal:

```bash
printf 'reload\n' | nc 127.0.0.1 <port>
```

Or JSONL:

```bash
printf '{"type":"reload"}\n' | nc 127.0.0.1 <port>
```

Note: hot reload is applied by `btuin dev` (dev runner).
