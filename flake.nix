{
  description = "btuin - TUI framework for Bun";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };

        # Bun
        bun = pkgs.bun;

        # Zig
        zig = pkgs.zig;

        # Task helper scripts
        task-build-ffi = pkgs.writeShellScriptBin "build-ffi" ''
          echo "Building Zig layout-engine..."
          cd packages/core/src/layout-engine

          # Build for current platform
          zig build -Doptimize=ReleaseFast

          # Create expected output structure
          mkdir -p target/release

          # Copy library to expected location
          if [ -f "zig-out/lib/liblayout-engine.dylib" ]; then
            cp zig-out/lib/liblayout-engine.dylib target/release/
            cp zig-out/lib/liblayout-engine.dylib ../../../
          elif [ -f "zig-out/lib/liblayout-engine.so" ]; then
            cp zig-out/lib/liblayout-engine.so target/release/
            cp zig-out/lib/liblayout-engine.so ../../../
          elif [ -f "zig-out/lib/layout-engine.dll" ]; then
            cp zig-out/lib/layout-engine.dll target/release/
            cp zig-out/lib/layout-engine.dll ../../../
          fi

          echo "✓ Built liblayout-engine"
        '';

        task-build-ffi-all = pkgs.writeShellScriptBin "build-ffi-all" ''
          echo "Building Zig layout-engine for all platforms..."
          cd packages/core/src/layout-engine
          zig build release
          echo "✓ Built all platform binaries"
        '';

        task-test-ffi = pkgs.writeShellScriptBin "test-ffi" ''
          echo "Running Zig layout-engine tests..."
          cd packages/core/src/layout-engine
          zig build test
          echo "✓ FFI tests passed"
        '';

        task-bench-ffi = pkgs.writeShellScriptBin "bench-ffi" ''
          echo "Running Zig layout-engine benchmarks..."
          cd packages/core/src/layout-engine
          zig build bench
          echo "✓ Benchmarks complete"
        '';

        task-lint = pkgs.writeShellScriptBin "lint" ''
          exec bunx oxlint packages/*/src tests "$@"
        '';

        task-lint-fix = pkgs.writeShellScriptBin "lint-fix" ''
          exec bunx oxlint packages/*/src tests --fix "$@"
        '';

        task-format = pkgs.writeShellScriptBin "format" ''
          exec bunx oxfmt packages/*/src tests
        '';

        task-check = pkgs.writeShellScriptBin "check" ''
          exec bunx tsc --noEmit
        '';

        task-precommit = pkgs.writeShellScriptBin "precommit" ''
          set -e
          echo "Running format..."
          format
          echo "Running lint-fix..."
          lint-fix
          echo "Running type check..."
          check
          echo "✓ Pre-commit checks passed"
        '';

        task-test = pkgs.writeShellScriptBin "test-btuin" ''
          exec bun test "$@"
        '';

        task-test-watch = pkgs.writeShellScriptBin "test-watch" ''
          exec bun test --watch
        '';

        task-profiler = pkgs.writeShellScriptBin "profiler" ''
          exec bun test ./packages/devtools/src/profiler*.spec.ts
        '';

        task-clean = pkgs.writeShellScriptBin "clean" ''
          rm -rf node_modules packages/*/node_modules
          rm -rf packages/core/src/layout-engine/zig-out
          rm -rf packages/core/src/layout-engine/.zig-cache
          rm -rf packages/core/src/layout-engine/target
          rm -f packages/core/liblayout-engine.*
          echo "Cleaned build artifacts"
        '';

        task-install = pkgs.writeShellScriptBin "install-all" ''
          exec bun install
        '';
      in
      {
        packages = {
          default = pkgs.writeShellScriptBin "btuin" ''
            exec ${bun}/bin/bun run ${self}/packages/cli/bin/btuin "$@"
          '';
        };

        devShells.default = pkgs.mkShell {
          buildInputs = [
            # Core tools
            bun
            zig

            # Build tasks
            task-build-ffi
            task-build-ffi-all
            task-test-ffi
            task-bench-ffi

            # Code quality tasks
            task-lint
            task-lint-fix
            task-format
            task-check
            task-precommit

            # Testing tasks
            task-test
            task-test-watch
            task-profiler

            # Utility tasks
            task-clean
            task-install
          ];
        };

        apps = {
          btuin = {
            type = "app";
            program = "${bun}/bin/bun";
            args = [ "run" "packages/cli/bin/btuin" ];
          };
        };
      }
    );
}
