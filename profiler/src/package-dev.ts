import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const PKG_ROOT = path.resolve(import.meta.dir, "..");
const DEFAULT_OUTDIR = path.join(PKG_ROOT, ".tmp", "package-dev");

type Options = {
  outdir: string;
};

function printHelp() {
  process.stderr.write(
    [
      "Usage:",
      "  bun run scripts/package-dev.ts [options]",
      "",
      "Options:",
      "  --outdir <path>     Output directory (default: .tmp/package-dev)",
      "  -h, --help          Show help",
      "",
    ].join("\n"),
  );
}

function parseArgs(argv: string[]): Options {
  let outdir = DEFAULT_OUTDIR;

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

    if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`[btuin] unknown option: ${a}`);
  }

  return { outdir };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (existsSync(options.outdir)) {
    await rm(options.outdir, { recursive: true, force: true });
  }
  await mkdir(options.outdir, { recursive: true });

  console.log("Copying package files...");
  const pkgJsonPath = path.join(PKG_ROOT, "package.json");
  const pkgJson = JSON.parse(await Bun.file(pkgJsonPath).text()) as { files?: string[] };

  await cp(pkgJsonPath, path.join(options.outdir, "package.json"));
  const filesToCopy = pkgJson.files ?? [];
  for (const file of filesToCopy) {
    await cp(path.join(PKG_ROOT, file), path.join(options.outdir, file), { recursive: true });
  }

  console.log(`Package staged at ${options.outdir}`);
}

await main();
