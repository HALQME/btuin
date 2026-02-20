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

        # Task helper scripts
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
          echo "Cleaned node_modules"
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
