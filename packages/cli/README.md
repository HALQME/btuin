# @btuin/cli

CLI tooling for btuin.

## Installation

```bash
bun add -d @btuin/cli
```

## Usage

```bash
# Run with hot reload
bun btuin dev ./src/main.ts

# Build for production
bun btuin build ./src/main.ts --out ./dist
```

## Commands

- `btuin dev <entry>` - Run with hot reload
- `btuin build <entry>` - Build for production

## DevTools

The CLI includes built-in DevTools for debugging your TUI applications:

```bash
bun btuin dev ./src/main.ts --devtools
```

This will start a web-based inspector accessible at the displayed URL.
