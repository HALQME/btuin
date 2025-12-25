# Architecture

## Core Design

btuin separates concerns into four distinct modules: state, layout, rendering, and I/O. The UI is defined declaratively as a component tree. The framework then handles layout, rendering, and updates.

## Modules

- **`reactivity`**: Provides a fine-grained reactivity system. When a `ref` changes, only dependent `computed` and `effect` functions are re-evaluated, avoiding a virtual DOM.

- **`layout-engine`**: Taffy, a Rust-based layout engine. It runs via FFI for high-performance layout calculations.

- **`renderer`**: Uses a double-buffer system. It compares the previous and current UI states to generate a minimal set of ANSI escape codes for terminal updates, which reduces flicker.

- **`terminal`**: Handles low-level terminal I/O. It parses ANSI escape sequences for events like key presses and manages raw mode.

- **`btuin` (Runtime)**: The top-level module that integrates all other parts. It provides `createApp`, manages the application lifecycle, and exposes the component API.

![Rendering pipeline](./assets/rendering-pipeline.svg)

![Fine-grained reactivity](./assets/reactivity-deps.svg)

![Key event propagation](./assets/key-event-propagation.svg)

## Component Context (Provide/Inject)

btuin provides a lightweight, Vue-like context mechanism to share values down the component tree without prop drilling.

- `provide(key, value)`: Registers a value on the current component instance.
- `inject(key, defaultValue?)`: Resolves a value by walking up the parent instance chain. Returns `defaultValue` (or `undefined`) if not found.

Keys can be `string` or typed `symbol` (`InjectionKey<T>`). `provide()`/`inject()` are intended to be called during component initialization (`setup`/`init`); calling them outside of component init will emit a warning and fall back to the default value.

```ts
import { defineComponent, inject, provide, ui } from "btuin";

const Child = defineComponent({
  setup() {
    const theme = inject("theme", "dark");
    return () => ui.Text(`theme=${theme}`);
  },
});

const Parent = defineComponent({
  setup() {
    provide("theme", "light");
    return () => ui.Block(/* ... */);
  },
});
```

![Provide/Inject context resolution](./assets/context-provide-inject.svg)

## Headless Execution

The I/O separation allows btuin to run in headless environments (e.g., CI). The UI renders to a TTY interface, while results can be directed to `stdout` via `runtime.setExitOutput()`. `Bun.Terminal` can be used for programmatic testing.

```ts
// Example of headless execution
import { Bun } from "bun";

const terminal = new Bun.Terminal({
  cols: 80,
  rows: 24,
  data(_term, data) {
    // Assert UI output from this stream
  },
});
const proc = Bun.spawn(["bun", "run", "my-app.ts"], { terminal });
terminal.write("q"); // Simulate key press
await proc.exited;
```

## Adapters

The adapter pattern abstracts platform and terminal details, improving portability and testability. Custom adapters can be provided to `createApp` to mock I/O.

```ts
import { createApp, type TerminalAdapter } from "btuin";

// Example of a mock adapter
const myMockTerminalAdapter: Partial<TerminalAdapter> = {
  write: (data) => {
    /* Mock write */
  },
  onKey: (listener) => {
    /* Mock listener */
  },
};

createApp({ terminal: myMockTerminalAdapter /* ... */ });
```

# Inline Mode

Inline mode renders the UI in-place (without clearing the whole terminal screen), making it suitable for prompts, progress indicators, or tools that should leave scrollback intact.

![Inline mode stdout/stderr passthrough](./assets/inline-stdout-stderr-passthrough.svg)

## Basic usage

```ts
import { createApp, ui } from "btuin";

const app = createApp({
  init: () => ({}),
  render: () => ui.Text("Hello (inline)"),
});

await app.mount({ inline: true });
```

## Cleanup behavior

- `inlineCleanupOnExit: false` (default): leaves the last rendered UI in the terminal output.
- `inlineCleanupOnExit: true`: clears the inline UI on `exit()`/`unmount()`.

```ts
await app.mount({ inline: true, inlineCleanupOnExit: true });
```

## stdout/stderr passthrough

When mounted in inline mode with the default terminal adapter, `process.stdout`/`process.stderr` output (including `console.log`) is printed above the inline UI and the UI is re-rendered afterwards.

## Exit / Unmount

![Exit lifecycle](./assets/exit-lifecycle.svg)
