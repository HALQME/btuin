import { afterAll, beforeAll, describe, it, expect } from "bun:test";
import { mkdir, rm, cp, readdir } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";

// Define the structure of the release matrix from release.yml
const RELEASE_MATRIX = [
  { os: "linux", arch: "x64", suffix: "so" },
  { os: "darwin", arch: "arm64", suffix: "dylib" },
];

const PKG_ROOT = path.resolve(import.meta.dir, "..");
const DIST_DIR = path.join(PKG_ROOT, "dist");
const TEMP_PKG_DIR = path.join(DIST_DIR, "package");
const NATIVE_DIR_IN_PKG = path.join(TEMP_PKG_DIR, "src/layout-engine/native");

describe("Package Verification", () => {
  // beforeAll: Executes the setup once before all tests in this file.
  beforeAll(async () => {
    console.log("Setting up test package environment...");

    // 1. Clean up previous artifacts
    if (existsSync(DIST_DIR)) {
      await rm(DIST_DIR, { recursive: true, force: true });
    }
    await mkdir(DIST_DIR, { recursive: true });

    // 2. Build the actual FFI library for the current platform
    console.log("Building FFI library for current platform...");
    try {
      execSync("mise run build:ffi", { stdio: "inherit", cwd: PKG_ROOT });
    } catch (e) {
      console.error("Failed to build FFI library. This is a prerequisite for the test.");
      throw e;
    }

    // 3. Simulate CI artifact placement
    console.log("Simulating CI artifact placement...");
    await mkdir(NATIVE_DIR_IN_PKG, { recursive: true });

    const currentPlatform = process.platform;
    const currentArch = process.arch;

    for (const target of RELEASE_MATRIX) {
      const binaryName = `liblayout_engine-${target.os}-${target.arch}.${target.suffix}`;
      const binaryPathInPkg = path.join(NATIVE_DIR_IN_PKG, binaryName);

      if (target.os === currentPlatform && target.arch === currentArch) {
        // This is the binary we just built. Copy it.
        const suffixMap: Record<string, string> = { darwin: "dylib", linux: "so", win32: "dll" };
        const builtBinaryName = `liblayout_engine.${suffixMap[currentPlatform] ?? target.suffix}`;
        const builtBinaryPath = path.join(
          PKG_ROOT,
          "src/layout-engine/target/release",
          builtBinaryName,
        );
        if (!existsSync(builtBinaryPath)) {
          throw new Error(`Could not find built binary at ${builtBinaryPath}`);
        }
        await cp(builtBinaryPath, binaryPathInPkg);
        console.log(`Copied actual binary: ${binaryName}`);
      } else {
        // For other platforms, create a dummy file to verify its existence.
        await Bun.write(binaryPathInPkg, `dummy for ${target.os}-${target.arch}`);
        console.log(`Created dummy binary: ${binaryName}`);
      }
    }

    // 4. Copy source files and package configs
    console.log("Copying source files...");
    const filesToCopy = ["src", "package.json", "README.md", "tsconfig.json"];
    for (const file of filesToCopy) {
      await cp(path.join(PKG_ROOT, file), path.join(TEMP_PKG_DIR, file), { recursive: true });
    }
    // Remove the rust build artifacts from the copied src
    await rm(path.join(TEMP_PKG_DIR, "src/layout-engine/target"), {
      recursive: true,
      force: true,
    });
    console.log("Setup complete.");
  });

  // afterAll: Clean up the created directories after all tests are done.
  afterAll(async () => {
    console.log("Cleaning up test package environment...");
    if (existsSync(DIST_DIR)) {
      await rm(DIST_DIR, { recursive: true, force: true });
    }
    console.log("Cleanup complete.");
  });

  it("should contain all native binaries for supported platforms", async () => {
    const filesInNativeDir = await readdir(NATIVE_DIR_IN_PKG);
    const expectedBinaries = RELEASE_MATRIX.map(
      (t) => `liblayout_engine-${t.os}-${t.arch}.${t.suffix}`,
    );

    for (const expected of expectedBinaries) {
      expect(filesInNativeDir).toContain(expected);
    }
    expect(filesInNativeDir.length).toBe(expectedBinaries.length);
  });

  it("should resolve the native binary path correctly when imported", async () => {
    // We are now trying to import the code *from the simulated package*.
    // This will use the path resolution logic within the packaged index.ts
    // which should correctly find the binary in the `native` directory.
    const layoutEnginePath = path.join(TEMP_PKG_DIR, "src/layout-engine/index.ts");

    // The expect().toThrow() check is inverted. We want to ensure it *doesn't* throw.
    // A successful import means the path was resolved.
    await expect(async () => {
      // The cleanup function is exported, we can use it to test if the module is loaded
      const { cleanupLayoutEngine, computeLayout } = await import(layoutEnginePath);
      expect(cleanupLayoutEngine).toBeInstanceOf(Function);
      expect(computeLayout).toBeInstanceOf(Function);
      // Call cleanup to ensure the engine instance is destroyed if it was created
      cleanupLayoutEngine();
    }).resolves.not.toThrow();
  });
});
