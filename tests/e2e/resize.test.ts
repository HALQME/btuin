import { describe, it, expect } from "bun:test";
import { createApp } from "@/index";
import { Block, Text } from "@/view/primitives";
import { createMockPlatform, createMockTerminal } from "./helpers";

describe("Resize integration", () => {
  it("clears screen and re-renders on resize", async () => {
    const terminal = createMockTerminal();
    const platform = createMockPlatform();

    const app = createApp({
      terminal,
      platform,
      init() {
        return {};
      },
      render: () => Block(Text("hello")),
    });

    await app.mount();
    await Bun.sleep(50);

    const clearBefore = terminal.calls.clearScreen;
    platform.trigger.resize();
    await Bun.sleep(50);

    expect(terminal.calls.clearScreen).toBeGreaterThan(clearBefore);
    expect(terminal.calls.write).toBeGreaterThan(0);
    app.unmount();
  });
});
