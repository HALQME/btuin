import { describe, it, expect, beforeAll } from "bun:test";
import { counterAppConfig } from "./counter";
import { sanitizeAnsi } from "@/sanitize";
import { createApp } from "@/index";
import { createMockPlatform, createMockTerminal } from "./helpers";

describe("Counter Example App with Mock Terminal", () => {
  beforeAll(() => Bun.gc(true));
  it("should increment and decrement counter on arrow key press", async () => {
    const terminal = createMockTerminal();
    const platform = createMockPlatform();
    const app = createApp({
      ...counterAppConfig,
      terminal,
      platform,
    });

    await app.mount();

    await Bun.sleep(200); // Wait for first render

    expect(sanitizeAnsi(terminal.output).trim()).toContain("Counter0");
    terminal.clearOutput();

    terminal.pressKey({ name: "up" });
    await Bun.sleep(100);

    expect(sanitizeAnsi(terminal.output)).toContain("1");
    terminal.clearOutput();

    terminal.pressKey({ name: "up" });
    await Bun.sleep(100);

    expect(sanitizeAnsi(terminal.output)).toContain("2");
    terminal.clearOutput();

    terminal.pressKey({ name: "down" });
    await Bun.sleep(100);

    expect(sanitizeAnsi(terminal.output)).toContain("1");
    terminal.clearOutput();

    terminal.pressKey({ name: "q" });
    await Bun.sleep(100);

    if (platform.state.exitCode === null) {
      throw new Error("Expected app to call platform.exit()");
    }
    expect<number>(platform.state.exitCode).toBe(0);

    app.unmount();
  });
});
