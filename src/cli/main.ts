import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseBtuinCliArgs } from "./args";
import { runHotReloadProcess } from "./hot-reload";

function printHelp() {
  process.stderr.write(
    [
      "btuin",
      "",
      "Usage:",
      "  btuin dev <entry> [options] [-- <args...>]",
      "",
      "Examples:",
      "  btuin dev examples/devtools.ts",
      "  btuin dev src/main.ts --watch src --watch examples",
      "  btuin dev src/main.ts -- --foo bar",
      "",
      "Options:",
      "  --watch <path>       Add watch path (repeatable)",
      "  --debounce <ms>      Debounce fs events (default: 50)",
      "  --cwd <path>         Child working directory (default: process.cwd())",
      "  --no-devtools        Disable browser DevTools auto-enable",
      "  --no-open-browser    Do not auto-open DevTools URL in browser",
      "  --no-tcp             Disable TCP reload trigger",
      "  --tcp-host <host>    TCP bind host (default: 127.0.0.1)",
      "  --tcp-port <port>    TCP bind port (default: 0)",
      "  -h, --help           Show help",
      "  -v, --version        Print version",
      "",
    ].join("\n"),
  );
}

function printVersion() {
  try {
    const pkgPath = fileURLToPath(new URL("../../package.json", import.meta.url));
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string; version?: string };
    process.stdout.write(`${pkg.name ?? "btuin"} ${pkg.version ?? ""}`.trimEnd() + "\n");
  } catch {
    process.stdout.write("btuin\n");
  }
}

function toAbsolutePath(cwd: string, p: string): string {
  return isAbsolute(p) ? p : resolve(cwd, p);
}

export async function btuinCli(argv: string[]) {
  let parsed: ReturnType<typeof parseBtuinCliArgs>;
  try {
    parsed = parseBtuinCliArgs(argv);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  if (parsed.kind === "help") {
    printHelp();
    return;
  }

  if (parsed.kind === "version") {
    printVersion();
    return;
  }

  const cwd = parsed.cwd ? resolve(process.cwd(), parsed.cwd) : process.cwd();

  const entryAbs = toAbsolutePath(cwd, parsed.entry);
  const watchPaths = (() => {
    const out: string[] = [];
    const add = (p: string) => {
      const abs = toAbsolutePath(cwd, p);
      if (!out.includes(abs)) out.push(abs);
    };

    if (parsed.watch.length > 0) {
      for (const p of parsed.watch) add(p);
      return out;
    }

    const srcDir = join(cwd, "src");
    if (existsSync(srcDir)) add(srcDir);

    const entryDir = dirname(entryAbs);
    if (existsSync(entryDir)) out.push(entryDir);

    if (out.length === 0) out.push(cwd);
    return out;
  })();

  let tcp:
    | undefined
    | {
        host?: string;
        port?: number;
        onListen: (info: { host: string; port: number }) => void;
      } = undefined;

  if (parsed.tcp.enabled) {
    tcp = {
      host: parsed.tcp.host ?? "127.0.0.1",
      port: parsed.tcp.port ?? 0,
      onListen: ({ host, port }) => {
        process.stderr.write(`[btuin] hot-reload tcp: ${host}:${port}\n`);
        process.stderr.write(`[btuin] trigger: printf 'reload\\n' | nc ${host} ${port}\n`);
      },
    };
  }

  const devtoolsEnv = (() => {
    const out: Record<string, string | undefined> = {};

    if (!parsed.devtools.enabled) {
      return {
        ...out,
        BTUIN_DEVTOOLS: undefined,
        BTUIN_DEVTOOLS_HOST: undefined,
        BTUIN_DEVTOOLS_PORT: undefined,
        BTUIN_DEVTOOLS_CONTROLLER: undefined,
      };
    }

    const env: Record<string, string | undefined> = { ...out, BTUIN_DEVTOOLS: "1" };

    // Let the runtime load DevTools via an env-provided module spec/path.
    // This avoids hard-coding an internal import path, which makes future package split easier.
    try {
      env.BTUIN_DEVTOOLS_CONTROLLER = fileURLToPath(
        new URL("../devtools/controller.ts", import.meta.url),
      );
    } catch {
      // ignore
    }

    // Keep DevTools URL stable across hot-reload restarts by pinning host/port once.
    const host = process.env.BTUIN_DEVTOOLS_HOST ?? "127.0.0.1";
    const portFromEnv = process.env.BTUIN_DEVTOOLS_PORT;
    if (!process.env.BTUIN_DEVTOOLS_HOST) env.BTUIN_DEVTOOLS_HOST = host;

    if (!portFromEnv) {
      try {
        // Reserve an ephemeral port, then close immediately. Best-effort.
        const listener = Bun.listen({
          hostname: host,
          port: 0,
          socket: {
            open() {},
            data() {},
            close() {},
            error() {},
          },
        });
        const port = listener.port;
        try {
          listener.stop(true);
        } catch {
          // ignore
        }
        env.BTUIN_DEVTOOLS_PORT = String(port);
        env.BTUIN_DEVTOOLS_HOST = host;
      } catch {
        // ignore; child will pick an ephemeral port
      }
    }

    return env;
  })();

  runHotReloadProcess({
    command: "bun",
    args: [entryAbs, ...parsed.childArgs],
    cwd,
    watch: { paths: watchPaths, debounceMs: parsed.debounceMs },
    env: devtoolsEnv,
    openDevtoolsBrowser: parsed.openBrowser && parsed.devtools.enabled,
    tcp: parsed.tcp.enabled
      ? {
          host: tcp!.host,
          port: tcp!.port,
          onListen: tcp!.onListen,
        }
      : undefined,
  });

  // Keep the CLI alive while the child runs.
  await new Promise(() => {});
}
