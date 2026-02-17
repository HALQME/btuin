{
  description = "btuin - TUI framework for Bun";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, flake-utils, rust-overlay }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        overlays = [ rust-overlay.overlays.default ];
        pkgs = import nixpkgs {
          inherit system overlays;
        };

        # Bun 1.3.5
        bun = pkgs.bun.overrideAttrs (oldAttrs: {
          version = "1.3.5";
        });

        # Rust toolchain 1.92.0
        rustToolchain = pkgs.rust-bin.stable."1.92.0".default.override {
          extensions = [ "rust-src" "rustfmt" "clippy" ];
        };

        # oxfmt and oxlint from npm
        oxfmt = pkgs.writeShellScriptBin "oxfmt" ''
          exec ${pkgs.nodePackages.npm}/bin/npx oxfmt "$@"
        '';

        oxlint = pkgs.writeShellScriptBin "oxlint" ''
          exec ${pkgs.nodePackages.npm}/bin/npx oxlint "$@"
        '';

        # Task helper scripts
        task-build-ffi = pkgs.writeShellScriptBin "build-ffi" ''
          echo "Building Rust FFI..."
          cd packages/core/src/layout-engine && cargo build --release
        '';

        task-lint = pkgs.writeShellScriptBin "lint" ''
          exec oxlint packages/*/src tests "$@"
        '';

        task-lint-fix = pkgs.writeShellScriptBin "lint-fix" ''
          exec oxlint packages/*/src tests --fix "$@"
        '';

        task-format = pkgs.writeShellScriptBin "format" ''
          exec oxfmt packages/*/src tests
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

        task-profiler-stress = pkgs.writeShellScriptBin "profiler-stress" ''
          exec bun test ./packages/devtools/src/profiler-stress.spec.ts
        '';

        task-profiler-layout = pkgs.writeShellScriptBin "profiler-layout" ''
          exec bun test ./packages/devtools/src/profiler-layout.spec.ts
        '';

        task-profiler-limit = pkgs.writeShellScriptBin "profiler-limit" ''
          exec bun test ./packages/devtools/src/profiler-limit.spec.ts
        '';

        task-clean = pkgs.writeShellScriptBin "clean" ''
          rm -rf node_modules packages/*/node_modules
          echo "Cleaned node_modules"
        '';

        task-install = pkgs.writeShellScriptBin "install-all" ''
          exec bun install
        '';
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            # Core tools
            bun
            rustToolchain
            pkgs.nodePackages.npm
            pkgs.nodePackages.typescript

            # Linting/formatting (wrapped npm packages)
            oxfmt
            oxlint

            # Build tasks
            task-build-ffi

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
            task-profiler-stress
            task-profiler-layout
            task-profiler-limit

            # Utility tasks
            task-clean
            task-install
          ];

          shellHook = ''
            echo "btuin development environment"
            echo ""
            echo "Available commands:"
            echo "  build-ffi         - Build the Rust FFI binary"
            echo "  lint              - Run oxlint on packages and tests"
            echo "  lint-fix          - Run oxlint with auto-fix"
            echo "  format            - Run oxfmt on packages and tests"
            echo "  check             - Run TypeScript type check"
            echo "  precommit         - Run format + lint-fix + check"
            echo "  test-btuin        - Run test suite"
            echo "  test-watch        - Run tests in watch mode"
            echo "  profiler          - Run profiler tests"
            echo "  profiler-stress   - Run stress profiler"
            echo "  profiler-layout   - Run layout profiler"
            echo "  profiler-limit    - Run limit profiler"
            echo "  clean             - Remove all node_modules"
            echo "  install-all       - Install dependencies"
            echo ""
          '';
        };

        # Apps for direct execution
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
