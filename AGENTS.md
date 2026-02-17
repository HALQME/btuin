# Repository Guidelines

## Project Structure & Module Organization

This repository is organized as a monorepo:

```
btuin/
├── packages/
│   ├── core/          # btuin - Core TUI framework (production code)
│   ├── cli/           # @btuin/cli - CLI tooling (development only)
│   └── devtools/      # @btuin/devtools - Development tools
├── apps/
│   └── docs/          # Documentation
├── tests/             # Bun test suite
│   ├── units/         # Focused unit tests by area
│   ├── integration/   # Cross-module behavior tests
│   └── e2e/           # End-to-end runs
├── examples/          # Runnable examples
└── flake.nix          # Nix development environment
```

### Package Structure

- `packages/core/src/`: TypeScript source for the `btuin` library
  - Public entry points live in `src/index.ts` and `src/**/index.ts`
- `packages/core/src/layout-engine/`: Rust layout engine (FFI)
- `packages/cli/src/`: CLI commands and devtools
- `packages/devtools/src/`: Profiler and performance tools

## Build, Test, and Development Commands

This repo uses **Nix Flakes** for reproducible development environment.

### Prerequisites

- [Nix](https://nixos.org/download.html) with flakes enabled
- [direnv](https://direnv.net/) (optional, for automatic environment activation)

### Setup

```bash
# Enter development shell (with direnv, this happens automatically)
nix develop

# Or with direnv:
direnv allow
```

### Available Commands

Once in the development shell:

- `bun install`: Install JS dependencies
- `build-ffi`: Build the Rust FFI binary (`packages/core/src/layout-engine/target/release`)
- `test-btuin`: Run tests (Bun's test runner)
- `test-watch`: Run tests in watch mode
- `format`: Format code with oxfmt
- `lint`: Lint with oxlint
- `lint-fix`: Lint with auto-fix
- `check`: TypeScript type-check (`bunx tsc --noEmit`)
- `precommit`: Run format + lint-fix + check before pushing
- `profiler`: Run profiler tests
- `clean`: Remove all node_modules

## Coding Style & Naming Conventions

- TypeScript (ESM) with strict type-checking (`tsconfig.json`)
- Prefer small, composable modules and re-export via `src/**/index.ts`
- Use lowercase filenames; use `kebab-case` for multi-word files (e.g., `render-loop.ts`)
- Run `test-btuin && precommit` after any edit
- Run `format` before opening a PR; let `oxfmt` decide whitespace
- This project targets Bun-native development; optimizing to remove Bun dependencies from the core package is not a goal

## Testing Guidelines

- Use Bun's test runner (`test-btuin`)
- Naming conventions include `*.test.ts`, `*.spec.ts`, and `*.integration.test.ts`; follow the closest existing pattern
- If you change the layout engine or its JS bindings, run `build-ffi` before `test-btuin`

## Commit & Pull Request Guidelines

- Commit messages in history are short and imperative (e.g., "Fix …", "Update …"); keep the subject concise and scoped (optionally prefix with an area like `renderer:`)
- PRs should include: what changed, why, how to test (exact commands), and any UX/output evidence for TUI changes (screenshot/recording if applicable)
