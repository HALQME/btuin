import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const RELEASE_MATRIX = [
  { os: "linux", arch: "x64", suffix: "so" },
  { os: "darwin", arch: "arm64", suffix: "dylib" },
];

const PLATFORM_SUFFIX: Record<string, string> = {
  darwin: "dylib",
  linux: "so",
  win32: "dll",
};

const PKG_ROOT = path.resolve(import.meta.dir, "..");
const DEFAULT_OUTDIR = path.join(PKG_ROOT, ".tmp", "package-dev");

type Options = {
  outdir: string;
  currentOnly: boolean;
};

function printHelp() {
  process.stderr.write(
    [
      "Usage:",
      "  bun run scripts/package-dev.ts [options]",
      "",
      "Options:",
      "  --outdir <path>     Output directory (default: .tmp/package-dev)",
      "  --current-only      Only include the current platform binary",
      "  -h, --help          Show help",
      "",
    ].join("\n"),
  );
}

function parseArgs(argv: string[]): Options {
  let outdir = DEFAULT_OUTDIR;
  let currentOnly = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;

    if (a === "--outdir") {
      const v = argv[i + 1];
      if (!v || v.startsWith("-")) {
        throw new Error("[btuin] missing value for --outdir");
      }
      outdir = path.resolve(PKG_ROOT, v);
      i++;
      continue;
    }

    if (a === "--current-only") {
      currentOnly = true;
      continue;
    }

    if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`[btuin] unknown option: ${a}`);
  }

  return { outdir, currentOnly };
}

async function run(command: string, args: string[], cwd: string) {
  const proc = Bun.spawn([command, ...args], {
    cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Command failed (${exitCode}): ${command} ${args.join(" ")}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (existsSync(options.outdir)) {
    await rm(options.outdir, { recursive: true, force: true });
  }
  await mkdir(options.outdir, { recursive: true });

  console.log("Building FFI library for current platform...");
  await run("mise", ["run", "build:ffi"], PKG_ROOT);

  console.log("Copying package files...");
  const pkgJsonPath = path.join(PKG_ROOT, "package.json");
  const pkgJson = JSON.parse(await Bun.file(pkgJsonPath).text()) as { files?: string[] };

  await cp(pkgJsonPath, path.join(options.outdir, "package.json"));
  const filesToCopy = pkgJson.files ?? [];
  for (const file of filesToCopy) {
    await cp(path.join(PKG_ROOT, file), path.join(options.outdir, file), { recursive: true });
  }

  const targetDir = path.join(options.outdir, "src/layout-engine/target");
  if (existsSync(targetDir)) {
    await rm(targetDir, { recursive: true, force: true });
  }

  console.log("Installing native binaries...");
  const nativeDir = path.join(options.outdir, "src/layout-engine/native");
  await mkdir(nativeDir, { recursive: true });

  const currentPlatform = process.platform;
  const currentArch = process.arch;
  const builtBinaryName = `liblayout_engine.${PLATFORM_SUFFIX[currentPlatform] ?? "so"}`;
  const builtBinaryPath = path.join(PKG_ROOT, "src/layout-engine/target/release", builtBinaryName);

  if (!existsSync(builtBinaryPath)) {
    throw new Error(`Could not find built binary at ${builtBinaryPath}`);
  }

  for (const target of RELEASE_MATRIX) {
    if (options.currentOnly && (target.os !== currentPlatform || target.arch !== currentArch)) {
      continue;
    }

    const binaryName = `liblayout_engine-${target.os}-${target.arch}.${target.suffix}`;
    const binaryPathInPkg = path.join(nativeDir, binaryName);

    if (target.os === currentPlatform && target.arch === currentArch) {
      await cp(builtBinaryPath, binaryPathInPkg);
      console.log(`Copied actual binary: ${binaryName}`);
      continue;
    }

    await Bun.write(binaryPathInPkg, `dummy for ${target.os}-${target.arch}`);
    console.log(`Created dummy binary: ${binaryName}`);
  }

  console.log(`Package staged at ${options.outdir}`);
}

await main();
