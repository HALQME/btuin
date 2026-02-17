# btuin

TUI framework for Bun.

## Installation

```bash
bun add btuin
```

## Usage

```typescript
import { createApp, Block, Text } from "btuin";

const app = createApp({
  init() {
    return { count: 0 };
  },
  render({ state }) {
    return Block(Text(`Count: ${state.count}`));
  },
});

await app.mount();
```

## Modules

- `btuin` - Core framework
- `btuin/components` - Component system
- `btuin/hooks` - Reactive hooks
- `btuin/view` - View primitives
- `btuin/renderer` - Terminal renderer
- `btuin/layout` - Layout engine integration
- `btuin/terminal` - Terminal utilities
- `btuin/reactivity` - Reactivity system

## CLI

For CLI tooling, install `@btuin/cli`:

```bash
bun add -d @btuin/cli
```

## DevTools

For development tools, install `@btuin/devtools`:

```bash
bun add -d @btuin/devtools
```
