import { isAbsolute, resolve, dirname, join } from "node:path";
import { suffix } from "bun:ffi";
import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Command } from "./command";

type SourcemapMode = "none" | "inline" | "external";

export interface BuildOptions {
  entry: string;
  cwd: string;
  outdir: string;
  minify: boolean;
  sourcemap: SourcemapMode;
}

function resolveLayoutEngineBinary(): { source: string; binName: string } {
  const cliDir = dirname(fileURLToPath(import.meta.url));
  const layoutEngineDir = resolve(cliDir, "..", "layout-engine");
  const platform = process.platform;
  const arch = process.arch;
  const binName = `liblayout_engine-${platform}-${arch}.${suffix}`;

  const packaged = join(layoutEngineDir, "native", binName);
  if (existsSync(packaged)) return { source: packaged, binName };

  const dev = join(layoutEngineDir, "target", "release", `liblayout_engine.${suffix}`);
  if (existsSync(dev)) return { source: dev, binName };

  throw new Error(
    `[btuin] layout engine binary not found. Looked for ${packaged} or ${dev}. ` +
      `Run "mise run build:ffi" or install a prebuilt package.`,
  );
}

export async function runBuild(options: BuildOptions) {
  const result = await Bun.build({
    entrypoints: [options.entry],
    outdir: options.outdir,
    target: "bun",
    format: "esm",
    splitting: false,
    minify: options.minify,
    sourcemap: options.sourcemap,
  });

  if (!result.success) {
    for (const log of result.logs) {
      process.stderr.write(`${log}\n`);
    }
    process.exitCode = 1;
    return;
  }

  const entryOutput =
    result.outputs.find((output) => output.kind === "entry-point") ?? result.outputs[0];
  const outputDir = entryOutput ? dirname(entryOutput.path) : options.outdir;

  const { source, binName } = resolveLayoutEngineBinary();
  const nativeDir = join(outputDir, "native");
  await mkdir(nativeDir, { recursive: true });
  const dest = join(nativeDir, binName);
  await copyFile(source, dest);

  process.stderr.write(`[btuin] build output: ${outputDir}\n`);
  process.stderr.write(`[btuin] layout engine: ${dest}\n`);
}

interface BuildParsed {
  entry: string;
  cwd?: string;
  outdir: string;
  minify: boolean;
  sourcemap: "none" | "inline" | "external";
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

function parseBuildArgs(argv: string[]): BuildParsed {
  let entry: string | null = null;
  let outdir = "dist";
  let minify = false;
  let sourcemap: "none" | "inline" | "external" = "external";
  let cwd: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;

    if (a === "--outdir") {
      const v = takeFlagValue(argv, i, "--outdir");
      outdir = v;
      i++;
      continue;
    }

    if (a === "--minify") {
      minify = true;
      continue;
    }

    if (a === "--sourcemap") {
      const v = takeFlagValue(argv, i, "--sourcemap");
      if (v !== "none" && v !== "inline" && v !== "external") {
        throw new Error(`[btuin] invalid --sourcemap: ${v}`);
      }
      sourcemap = v;
      i++;
      continue;
    }

    if (a === "--cwd") {
      const v = takeFlagValue(argv, i, "--cwd");
      cwd = v;
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

    throw new Error(`[btuin] unexpected extra argument: ${a}`);
  }

  if (!entry) throw new Error("[btuin] missing entry path (e.g. btuin build src/main.ts)");

  return {
    entry,
    cwd,
    outdir,
    minify,
    sourcemap,
  };
}

export const buildCommand: Command<BuildParsed> = {
  name: "build",
  summary: "Bundle an app",
  help: {
    usage: "<entry> [options]",
    examples: ["btuin build src/main.ts --outdir dist"],
    options: [
      {
        flags: ["--outdir"],
        value: "<path>",
        description: "Build output directory",
        defaultValue: "dist",
      },
      { flags: ["--minify"], description: "Minify bundled output" },
      {
        flags: ["--sourcemap"],
        value: "<mode>",
        description: "Sourcemap: none | inline | external",
        defaultValue: "external",
      },
      {
        flags: ["--cwd"],
        value: "<path>",
        description: "Child working directory",
        defaultValue: "process.cwd()",
      },
      { flags: ["-h", "--help"], description: "Show help" },
    ],
  },
  parse: parseBuildArgs,
  run: async (parsed: BuildParsed) => {
    const cwd = parsed.cwd ? resolve(process.cwd(), parsed.cwd) : process.cwd();
    const entryAbs = toAbsolutePath(cwd, parsed.entry);
    const outdirAbs = toAbsolutePath(cwd, parsed.outdir);

    await runBuild({
      cwd,
      entry: entryAbs,
      outdir: outdirAbs,
      minify: parsed.minify,
      sourcemap: parsed.sourcemap,
    });
  },
};
