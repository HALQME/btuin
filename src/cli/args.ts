export type BtuinCliParsed =
  | { kind: "help" }
  | { kind: "version" }
  | {
      kind: "dev";
      entry: string;
      childArgs: string[];
      cwd?: string;
      watch: string[];
      debounceMs?: number;
      devtools: { enabled: boolean };
      openBrowser: boolean;
      tcp: { enabled: false } | { enabled: true; host?: string; port?: number };
    };

function takeFlagValue(argv: string[], idx: number, flagName: string): string {
  const value = argv[idx + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`[btuin] missing value for ${flagName}`);
  }
  return value;
}

export function parseBtuinCliArgs(argv: string[]): BtuinCliParsed {
  const args = [...argv];
  if (args.length === 0) return { kind: "help" };

  if (args.includes("-h") || args.includes("--help")) return { kind: "help" };
  if (args.includes("-v") || args.includes("--version")) return { kind: "version" };

  const [subcommand, ...rest] = args;
  if (subcommand !== "dev") return { kind: "help" };

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
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a === "--") {
      passthrough = true;
      continue;
    }

    if (passthrough) {
      childArgs.push(a);
      continue;
    }

    if (a === "--watch") {
      const v = takeFlagValue(rest, i, "--watch");
      watch.push(v);
      i++;
      continue;
    }

    if (a === "--debounce") {
      const v = takeFlagValue(rest, i, "--debounce");
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) throw new Error(`[btuin] invalid --debounce: ${v}`);
      debounceMs = n;
      i++;
      continue;
    }

    if (a === "--cwd") {
      const v = takeFlagValue(rest, i, "--cwd");
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
      const v = takeFlagValue(rest, i, "--tcp-host");
      tcpHost = v;
      i++;
      continue;
    }

    if (a === "--tcp-port") {
      const v = takeFlagValue(rest, i, "--tcp-port");
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
    kind: "dev",
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
