import { describe, it, expect } from "bun:test";
import { createApp } from "@/index";
import { Block, Text } from "@/view";
import { sanitizeAnsi } from "@/renderer";
import { createMockPlatform, createMockTerminal } from "./helpers";

describe("Runtime exit integration", () => {
  it("writes exit output on normal exit", async () => {
    const terminal = createMockTerminal();
    const platform = createMockPlatform();

    const app = createApp({
      terminal,
      platform,
      init({ runtime }) {
        runtime.setExitOutput("bye");
        runtime.exit(0);
        return {};
      },
      render: () => Block(Text("ignored")),
    });

    await app.mount();
    await Bun.sleep(50);

    expect(platform.state.exitCode).toBe(0);
    expect(sanitizeAnsi(terminal.output)).toContain("bye");
    app.unmount();
  });

  it("does not write exit output on sigint exit", async () => {
    const terminal = createMockTerminal();
    const platform = createMockPlatform();

    const app = createApp({
      terminal,
      platform,
      init({ runtime }) {
        runtime.setExitOutput("should-not-print");
        runtime.exit(0, "sigint");
        return {};
      },
      render: () => Block(Text("ignored")),
    });

    await app.mount();
    await Bun.sleep(50);

    expect(platform.state.exitCode).toBe(0);
    expect(sanitizeAnsi(terminal.output)).not.toContain("should-not-print");
    app.unmount();
  });

  it("triggers sigint exit on unhandled ctrl+c", async () => {
    const terminal = createMockTerminal();
    const platform = createMockPlatform();

    let exitReason: string | null = null;
    const app = createApp({
      terminal,
      platform,
      init({ runtime }) {
        runtime.onExit((info) => {
          exitReason = info.reason;
        });
        return {};
      },
      render: () => Block(Text("ready")),
    });

    await app.mount();
    await Bun.sleep(50);

    terminal.pressKey({ sequence: "\x03", name: "c", ctrl: true });
    await Bun.sleep(50);

    expect(platform.state.exitCode).toBe(0);
    if (exitReason === null) {
      throw new Error("Expected runtime.onExit to capture a reason");
    }
    expect<string>(exitReason).toBe("sigint");
    app.unmount();
  });
});
