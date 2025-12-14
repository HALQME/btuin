import { describe, it, expect, afterEach, mock, afterAll } from "bun:test";
import { createApp, type AppInstance } from "../../src/runtime/app";
import { ref } from "@btuin/reactivity";
import * as terminal from "@btuin/terminal";
import { Block, Text } from "../../src/view/primitives";

// Mock dependencies
const keyHandlers: any[] = [];

mock.module("@btuin/terminal", () => ({
  setupRawMode: () => {},
  clearScreen: () => {},
  cleanupWithoutClear: () => {},
  patchConsole: () => {},
  startCapture: () => {},
  write: (_output: string) => {},
  onKey: (callback: any) => {
    keyHandlers.push(callback);
    (global as any).__btuin_onKeyCallback = (event: any) => {
      for (const handler of keyHandlers) {
        handler(event);
      }
    };
  },
  getTerminalSize: () => ({ rows: 24, cols: 80 }),
  disposeSingletonCapture: () => {},
}));

mock.module("../../../src/layout", () => ({
  initLayoutEngine: async () => {},
}));

describe("createApp", () => {
  let app: AppInstance;
  const platform = {
    onStdoutResize: () => {},
    onExit: () => {},
    onSigint: () => {},
    onSigterm: () => {},
    exit: () => {},
  };

  afterAll(() => {
    mock.restore();
  });

  afterEach(() => {
    if (app) {
      app.unmount();
    }
  });

  it("should create an app instance", () => {
    app = createApp({
      platform,
      setup() {
        return () => Block(Text("test"));
      },
    });
    expect(app).toBeDefined();
    expect(app.mount).toBeInstanceOf(Function);
    expect(app.unmount).toBeInstanceOf(Function);
    expect(app.getComponent).toBeInstanceOf(Function);
  });

  it("should mount and unmount the app", async () => {
    let setupCalled = false;
    app = createApp({
      platform,
      setup() {
        setupCalled = true;
        return () => Block(Text("test"));
      },
    });

    await app.mount();
    expect(setupCalled).toBe(true);
    expect(app.getComponent()).toBeDefined();

    app.unmount();
    expect(app.getComponent()).toBe(null);
  });

  it("should handle key events", async () => {
    let keyValue = "";
    app = createApp({
      platform,
      setup() {
        const key = ref("");
        terminal.onKey((k) => {
          key.value = k.name;
          keyValue = k.name;
        });
        return () => Block(Text(key.value));
      },
    });

    await app.mount();

    // Manually trigger the key event
    const onKeyCallback = (global as any).__btuin_onKeyCallback;
    if (onKeyCallback) {
      onKeyCallback({ name: "a", sequence: "a", ctrl: false, meta: false, shift: false });
    }

    // We can't directly test the rendered output without a full render cycle,
    // but we can check if the key event was processed.
    expect(keyValue).toBe("a");
  });
});
