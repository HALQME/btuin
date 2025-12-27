# btuin

Declarative TUI framework for the Bun runtime.

## Features

- **Declarative UI**: Describe your interface with a tree of components.
- **Reactivity Model**: The UI automatically updates when the state (`ref`, `computed`) it depends on changes. The framework tracks dependencies to re-render only necessary components, without using a Virtual DOM.
- **Flexbox-based Layout**: Uses [Taffy](https://github.com/DioxusLabs/taffy), a Rust-based layout engine, via FFI to calculate Flexbox-like layouts.
- **Optimized Rendering**: The renderer reduces TTY writes by creating a diff between the previous and current screen states. It also supports partial re-rendering for optimized scrolling performance.
- **Bun Native**: Built for the Bun runtime, utilizing its fast TTY, FFI, and pseudo-terminal APIs.
- **Type-Safe**: Written in TypeScript.

## Developer Experience

- **Hot Reloading**: The `btuin dev` command provides a file-watching development runner that automatically restarts your TUI on changes, enabling a fast feedback loop.

- **Browser-Based DevTools**: An integrated inspector allows you to view the component tree, check component-level logs, and debug layout and rendering in real-time in your web browser.

## Installation

```bash
bun add btuin
```

Publishing/install details: `docs/github-packages.md`

## Usage

The following code creates a simple counter that increments and decrements with the arrow keys.

```ts
import { createApp, ref, ui } from "btuin";

const app = createApp({
  // `init` is called once to set up state and event listeners.
  init({ onKey, runtime }) {
    const count = ref(0);

    onKey((keyEvent) => {
      if (keyEvent.name === "up") count.value++;
      if (keyEvent.name === "down") count.value--;
      if (keyEvent.name === "q") runtime.exit(0);
    });

    return { count };
  },

  // `render` returns the UI tree. It re-runs whenever state changes.
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

## More Examples

### Inline Progress Bar

You can render a UI inline without clearing the entire terminal screen. This is useful for progress bars, prompts, or interactive tools that should not disrupt the terminal's scrollback history.

When `inline` mode is active, `stdout` and `stderr` are automatically routed above the rendered UI.

```ts
import { createApp, ref, ui } from "btuin";

const app = createApp({
  init({ onKey, onTick, runtime, setExitOutput }) {
    const progress = ref(0);

    onKey((k) => k.name === "q" && runtime.exit(0));

    onTick(() => {
      progress.value++;
      if (progress.value >= 100) {
        setExitOutput("Done!");
        runtime.exit(0);
      }
    }, 25);

    return { progress };
  },
  render({ progress }) {
    return ui.Text(`Progress: ${progress.value}%`);
  },
});

await app.mount({
  inline: true,
  // Clear the UI from the screen on exit
  inlineCleanupOnExit: true,
});
```

### Virtualized List

`btuin` can render long lists of items efficiently using a virtualized `Windowed` component. Only the visible items (plus an "overscan" buffer) are rendered, keeping performance high even with thousands of items.

```ts
import { createApp, ref, ui } from "btuin";

const TOTAL = 50_000;
const items = Array.from({ length: TOTAL }, (_, i) => `item ${i}`);

const app = createApp({
  init({ onKey, runtime }) {
    const scrollIndex = ref(0);

    onKey((k) => {
      if (k.name === "q") runtime.exit(0);
      // NOTE: `clampWindowedStartIndex` is a helper to ensure
      // the scroll index stays within valid bounds.
      if (k.name === "down") scrollIndex.value++;
      if (k.name === "up") scrollIndex.value--;
      if (k.name === "pagedown") scrollIndex.value += 20;
      if (k.name === "pageup") scrollIndex.value -= 20;
    });

    return { scrollIndex };
  },
  render({ scrollIndex }) {
    const list = ui.Windowed({
      items,
      startIndex: scrollIndex.value,
      renderItem: (item) => ui.Text(item),
    });

    return ui.VStack([
      ui.Text(`Displaying ${items.length} items (q to quit)`),
      list,
    ]);
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

- [**Architecture**](./docs/architecture.md): Learn about the core design, reactivity system, and rendering pipeline.
- [**Developer Tools**](./docs/devtools.md): See how to use the browser-based inspector and hot reloading.
- [**GitHub**](https://github.com/HALQME/btuin): View the source code, open issues, and contribute.

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
