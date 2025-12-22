import { describe, it, expect } from "bun:test";
import { createApp } from "@/index";
import { Block, Text } from "@/view/primitives";
import { createMockPlatform, createMockTerminal } from "../e2e/helpers";

describe("Framework integration: App lifecycle", () => {
  it("mount wires terminal capture and raw mode", async () => {
    const terminal = createMockTerminal();
    const platform = createMockPlatform();

    const app = createApp({
      terminal,
      platform,
      init() {
        return {};
      },
      render: () => Block(Text("ok")),
    });

    await app.mount();
    await Bun.sleep(50);

    expect(terminal.calls.patchConsole).toBeGreaterThan(0);
    expect(terminal.calls.startCapture).toBeGreaterThan(0);
    expect(terminal.calls.setupRawMode).toBeGreaterThan(0);
    expect(terminal.calls.clearScreen).toBeGreaterThan(0);

    app.unmount();
  });

  it("unmount cleans up capture and console patch", async () => {
    const terminal = createMockTerminal();
    const platform = createMockPlatform();

    const app = createApp({
      terminal,
      platform,
      init() {
        return {};
      },
      render: () => Block(Text("ok")),
    });

    await app.mount();
    await Bun.sleep(50);
    app.unmount();

    expect(terminal.calls.stopCapture).toBeGreaterThan(0);
    expect(terminal.calls.unpatchConsole).toBeGreaterThan(0);
    expect(terminal.calls.disposeSingletonCapture).toBeGreaterThan(0);
    expect(terminal.calls.cleanupWithoutClear).toBeGreaterThan(0);
  });

  it("exit moves cursor to last row and clears screen", async () => {
    const terminal = createMockTerminal();
    const platform = createMockPlatform();

    const app = createApp({
      terminal,
      platform,
      init({ runtime }) {
        runtime.setExitOutput("done");
        runtime.exit(0);
        return {};
      },
      render: () => Block(Text("ignored")),
    });

    await app.mount();
    await Bun.sleep(50);

    expect(platform.state.exitCode).toBe(0);
    expect(terminal.calls.moveCursor.length).toBeGreaterThan(0);
    expect(terminal.calls.clearScreen).toBeGreaterThan(0);
    app.unmount();
  });

  it("exit in inline mode does not clear screen", async () => {
    const terminal = createMockTerminal();
    const platform = createMockPlatform();

    const app = createApp({
      terminal,
      platform,
      init({ runtime }) {
        runtime.setExitOutput("done");
        runtime.exit(0);
        return {};
      },
      render: () => Block(Text("ignored")),
    });

    await app.mount({ inline: true });
    await Bun.sleep(50);

    expect(platform.state.exitCode).toBe(0);
    expect(terminal.calls.moveCursor.length).toBe(0);
    expect(terminal.calls.clearScreen).toBe(0);
    app.unmount();
  });

  it("prevents mounting two apps in one process", async () => {
    const t1 = createMockTerminal();
    const p1 = createMockPlatform();
    const app1 = createApp({
      terminal: t1,
      platform: p1,
      init() {
        return {};
      },
      render: () => Block(Text("one")),
    });

    const t2 = createMockTerminal();
    const p2 = createMockPlatform();
    const app2 = createApp({
      terminal: t2,
      platform: p2,
      init() {
        return {};
      },
      render: () => Block(Text("two")),
    });

    await app1.mount();
    await Bun.sleep(50);

    let error: unknown = null;
    try {
      await app2.mount();
    } catch (e) {
      error = e;
    } finally {
      app1.unmount();
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("Only one app may be mounted");
  });
});
