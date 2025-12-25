import { isAbsolute, resolve, dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runHotReloadProcess } from "../hot-reload";
import type { Command } from "./command";

type DevtoolsEnv = Record<string, string | undefined>;

export interface DevCommandOptions {
  entry: string;
  cwd: string;
  watch: string[];
  debounceMs?: number;
  devtools: { enabled: boolean };
  openBrowser: boolean;
  tcp: { enabled: false } | { enabled: true; host?: string; port?: number };
  childArgs: string[];
}

export function runDev(options: DevCommandOptions) {
  const entryAbs = options.entry;
  const watchPaths = (() => {
    const out: string[] = [];
    const add = (p: string) => {
      const abs = resolve(options.cwd, p);
      if (!out.includes(abs)) out.push(abs);
    };

    if (options.watch.length > 0) {
      for (const p of options.watch) add(p);
      return out;
    }

    const srcDir = join(options.cwd, "src");
    if (existsSync(srcDir)) add(srcDir);

    const entryDir = dirname(entryAbs);
    if (existsSync(entryDir)) out.push(entryDir);

    if (out.length === 0) out.push(options.cwd);
    return out;
  })();

  let tcp:
    | undefined
    | {
        host?: string;
        port?: number;
        onListen: (info: { host: string; port: number }) => void;
      } = undefined;

  if (options.tcp.enabled) {
    tcp = {
      host: options.tcp.host ?? "127.0.0.1",
      port: options.tcp.port ?? 0,
      onListen: ({ host, port }) => {
        process.stderr.write(`[btuin] hot-reload tcp: ${host}:${port}\n`);
        process.stderr.write(`[btuin] trigger: printf 'reload\\n' | nc ${host} ${port}\n`);
      },
    };
  }

  const devtoolsEnv: DevtoolsEnv = (() => {
    if (!options.devtools.enabled) {
      return {
        BTUIN_DEVTOOLS: undefined,
        BTUIN_DEVTOOLS_HOST: undefined,
        BTUIN_DEVTOOLS_PORT: undefined,
        BTUIN_DEVTOOLS_CONTROLLER: undefined,
      };
    }

    const env: DevtoolsEnv = { BTUIN_DEVTOOLS: "1" };

    try {
      env.BTUIN_DEVTOOLS_CONTROLLER = fileURLToPath(
        new URL("../devtools/controller.ts", import.meta.url),
      );
    } catch {
      // ignore
    }

    const host = process.env.BTUIN_DEVTOOLS_HOST ?? "127.0.0.1";
    const portFromEnv = process.env.BTUIN_DEVTOOLS_PORT;
    if (!process.env.BTUIN_DEVTOOLS_HOST) env.BTUIN_DEVTOOLS_HOST = host;

    if (!portFromEnv) {
      try {
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
        // ignore
      }
    }

    return env;
  })();

  runHotReloadProcess({
    command: "bun",
    args: [entryAbs, ...options.childArgs],
    cwd: options.cwd,
    watch: { paths: watchPaths, debounceMs: options.debounceMs },
    env: devtoolsEnv,
    openDevtoolsBrowser: options.openBrowser && options.devtools.enabled,
    tcp: options.tcp.enabled
      ? {
          host: tcp!.host,
          port: tcp!.port,
          onListen: tcp!.onListen,
        }
      : undefined,
  });
}

interface DevParsed {
  entry: string;
  childArgs: string[];
  cwd?: string;
  watch: string[];
  debounceMs?: number;
  devtools: { enabled: boolean };
  openBrowser: boolean;
  tcp: { enabled: false } | { enabled: true; host?: string; port?: number };
}

function takeFlagValue(argv: string[], idx: number, flagName: string): string {
  const value = argv[idx + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`[btuin] missing value for ${flagName}`);
  }
  return value;
}

function toAbsolutePath(cwd: string, p: string): string {
  return isAbsolute(p) ? p : resolve(cwd, p);
}

function parseDevArgs(argv: string[]): DevParsed {
  let entry: string | null = null;
  const childArgs: string[] = [];
  const watch: string[] = [];
  let debounceMs: number | undefined;
  let cwd: string | undefined;
  let tcpEnabled = true;
  let tcpHost: string | undefined;
  let tcpPort: number | undefined;
  let devtoolsEnabled = true;
  let openBrowser = true;

  let passthrough = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--") {
      passthrough = true;
      continue;
    }

    if (passthrough) {
      childArgs.push(a);
      continue;
    }

    if (a === "--watch") {
      const v = takeFlagValue(argv, i, "--watch");
      watch.push(v);
      i++;
      continue;
    }

    if (a === "--debounce") {
      const v = takeFlagValue(argv, i, "--debounce");
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) throw new Error(`[btuin] invalid --debounce: ${v}`);
      debounceMs = n;
      i++;
      continue;
    }

    if (a === "--cwd") {
      const v = takeFlagValue(argv, i, "--cwd");
      cwd = v;
      i++;
      continue;
    }

    if (a === "--no-tcp") {
      tcpEnabled = false;
      continue;
    }

    if (a === "--no-devtools") {
      devtoolsEnabled = false;
      continue;
    }

    if (a === "--no-open-browser") {
      openBrowser = false;
      continue;
    }

    if (a === "--tcp-host") {
      const v = takeFlagValue(argv, i, "--tcp-host");
      tcpHost = v;
      i++;
      continue;
    }

    if (a === "--tcp-port") {
      const v = takeFlagValue(argv, i, "--tcp-port");
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 65535)
        throw new Error(`[btuin] invalid --tcp-port: ${v}`);
      tcpPort = n;
      i++;
      continue;
    }

    if (a.startsWith("-")) {
      throw new Error(`[btuin] unknown option: ${a}`);
    }

    if (!entry) {
      entry = a;
      continue;
    }

    // Treat extra args as passthrough to the child.
    childArgs.push(a);
  }

  if (!entry) throw new Error("[btuin] missing entry path (e.g. btuin dev examples/devtools.ts)");

  return {
    entry,
    childArgs,
    cwd,
    watch,
    debounceMs,
    devtools: { enabled: devtoolsEnabled },
    openBrowser,
    tcp: tcpEnabled ? { enabled: true, host: tcpHost, port: tcpPort } : { enabled: false },
  };
}

export const devCommand: Command<DevParsed> = {
  name: "dev",
  summary: "Run with hot reload",
  help: {
    usage: "<entry> [options] [-- <args...>]",
    examples: [
      "btuin dev examples/devtools.ts",
      "btuin dev src/main.ts --watch src --watch examples",
      "btuin dev src/main.ts -- --foo bar",
    ],
    options: [
      { flags: ["--watch"], value: "<path>", description: "Add watch path (repeatable)" },
      {
        flags: ["--debounce"],
        value: "<ms>",
        description: "Debounce fs events",
        defaultValue: "50",
      },
      {
        flags: ["--cwd"],
        value: "<path>",
        description: "Child working directory",
        defaultValue: "process.cwd()",
      },
      { flags: ["--no-devtools"], description: "Disable browser DevTools auto-enable" },
      { flags: ["--no-open-browser"], description: "Do not auto-open DevTools URL in browser" },
      { flags: ["--no-tcp"], description: "Disable TCP reload trigger" },
      {
        flags: ["--tcp-host"],
        value: "<host>",
        description: "TCP bind host",
        defaultValue: "127.0.0.1",
      },
      {
        flags: ["--tcp-port"],
        value: "<port>",
        description: "TCP bind port",
        defaultValue: "0",
      },
      { flags: ["-h", "--help"], description: "Show help" },
    ],
  },
  parse: parseDevArgs,
  run: (parsed: DevParsed) => {
    const cwd = parsed.cwd ? resolve(process.cwd(), parsed.cwd) : process.cwd();
    const entryAbs = toAbsolutePath(cwd, parsed.entry);

    runDev({
      entry: entryAbs,
      cwd,
      watch: parsed.watch,
      debounceMs: parsed.debounceMs,
      devtools: parsed.devtools,
      openBrowser: parsed.openBrowser,
      tcp: parsed.tcp,
      childArgs: parsed.childArgs,
    });

    // Keep the CLI alive while the child runs.
    return new Promise<void>(() => {});
  },
};
