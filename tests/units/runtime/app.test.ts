import { describe, it, expect, afterEach, beforeAll } from "bun:test";
import { ref } from "@/reactivity";
import { Block, Text } from "@/view/primitives";
import type { AppType as App, KeyEvent, TerminalAdapter } from "@/types";

const keyHandlers: any[] = [];

describe("createApp", () => {
  let appInstance: App;
  let app: typeof import("@/runtime/app").app;
  const terminal: TerminalAdapter = {
    setBracketedPaste: () => {},
    setupRawMode: () => {},
    clearScreen: () => {},
    moveCursor: () => {},
    cleanupWithoutClear: () => {},
    patchConsole: () => () => {},
    startCapture: () => {},
    stopCapture: () => {},
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
    write: (_output: string) => {},
  };
  const platform = {
    onStdoutResize: () => () => {},
    onExit: () => {},
    onSigint: () => {},
    onSigterm: () => {},
    exit: (_code?: number) => {},
  };

  beforeAll(async () => {
    ({ app } = await import("@/runtime/app"));
  });

  afterEach(() => {
    if (appInstance) {
      appInstance.unmount();
    }
    keyHandlers.length = 0;
    delete (global as any).__btuin_onKeyCallback;
  });

  it("should create an app instance", () => {
    appInstance = app({
      terminal,
      platform,
      init() {
        return {};
      },
      render: () => Block(Text("test")),
    });
    expect(appInstance).toBeDefined();
    expect(appInstance.mount).toBeInstanceOf(Function);
    expect(appInstance.unmount).toBeInstanceOf(Function);
    expect(appInstance.getComponent).toBeInstanceOf(Function);
  });

  it("should mount and unmount the app", async () => {
    let initCalled = false;
    const bracketedPasteCalls: boolean[] = [];
    appInstance = app({
      terminal: {
        ...terminal,
        setBracketedPaste: (enabled) => bracketedPasteCalls.push(enabled),
      },
      platform,
      init() {
        initCalled = true;
        return { ready: true };
      },
      render({ ready }) {
        return Block(Text(String(ready)));
      },
    });

    await appInstance.mount();
    expect(initCalled).toBe(true);
    expect(appInstance.getComponent()).toBeDefined();
    expect(bracketedPasteCalls[0]).toBe(true);

    appInstance.unmount();
    expect(appInstance.getComponent()).toBe(null);
    expect(bracketedPasteCalls).toEqual([true, false]);
  });

  it("should handle key events", async () => {
    let keyValue = "";
    appInstance = app({
      terminal,
      platform,
      init({ onKey }) {
        const key = ref("");
        onKey((k: KeyEvent) => {
          key.value = k.name;
          keyValue = k.name;
        });
        return { key };
      },
      render({ key }) {
        return Block(Text(key.value));
      },
    });

    await appInstance.mount();

    // Manually trigger the key event
    const onKeyCallback = (global as any).__btuin_onKeyCallback;
    if (onKeyCallback) {
      onKeyCallback({ name: "a", sequence: "a", ctrl: false, meta: false, shift: false });
    }

    // We can't directly test the rendered output without a full render cycle,
    // but we can check if the key event was processed.
    expect(keyValue).toBe("a");
  });

  it("should mount in inline mode without clearing the screen", async () => {
    const calls: { clearScreen: number; writes: string[] } = { clearScreen: 0, writes: [] };

    appInstance = app({
      terminal: {
        ...terminal,
        clearScreen: () => {
          calls.clearScreen++;
        },
        write: (output: string) => {
          calls.writes.push(output);
        },
      },
      platform,
      init() {
        return {};
      },
      render: () => Block(Text("X")),
    });

    await appInstance.mount({ rows: 2, cols: 3, inline: true });

    expect(calls.clearScreen).toBe(0);
    expect(calls.writes.join("")).toContain("\x1b[2K\r");

    const beforeUnmount = calls.writes.join("");
    appInstance.unmount();
    const afterUnmount = calls.writes.join("");
    expect(afterUnmount).toBe(beforeUnmount);
  });
});
