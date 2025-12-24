# btuin

Declarative TUI framework for the Bun runtime.

## Features

- **Fine-Grained Reactivity**: No virtual DOM. Only components that depend on changed state are re-rendered.
- **Flexbox-based Layout**: A Rust-powered engine that implements a subset of Flexbox for responsive layouts.
- **Bun Native**: Integrated with Bun's fast TTY, FFI, and pseudo-terminal APIs.
- **Type-Safe**: Written in TypeScript.

## Installation

```bash
bun add btuin
```

## Usage

```ts
import { createApp, ref, ui } from "btuin";

const app = createApp({
  // init: setup state and event listeners.
  init({ onKey, runtime }) {
    const count = ref(0);

    onKey((keyEvent) => {
      if (keyEvent.name === "up") count.value++;
      if (keyEvent.name === "down") count.value--;
      if (keyEvent.name === "q") runtime.exit(0);
    });

    return { count };
  },

  // render: returns the UI tree. Re-runs when state changes.
  render({ count }) {
    return ui
      .VStack([ui.Text("Counter"), ui.Text(String(count.value))])
      .width("100%")
      .height("100%")
      .justify("center") // Center children vertically
      .align("center"); // Center children horizontally
  },
});

await app.mount();
```

## API Overview

- `createApp(options)`: Creates an application instance.
  - `options.init`: Function to initialize state and register listeners.
  - `options.render`: Function that returns the UI component tree.
- `ref(value)`: Creates a reactive state variable.
- `computed(() => ...)`: Creates a derived reactive value.
- `watch(ref, () => ...)`: Runs a side effect when a ref changes.
- `ui`: Object with primitive components (`Text`, `Block`, `VStack`, etc.).

## Links

- [**Documentation**](./docs/) (Architecture, Roadmap)
- [**GitHub**](https://github.com/HALQME/btuin) (Source Code, Issues)

## Language

- [日本語 (Japanese)](./README.ja.md)

## Contributing

Contributions are welcome.

> This repository uses `mise` for tool management (`mise install`).

### Development Setup

```bash
# Install dependencies
mise exec -- bun install --frozen-lockfile

# Build the native layout-engine
mise run build:ffi

# Run tests
mise run test
```
