import { describe, it, expect, beforeAll, beforeEach } from "bun:test";
import { createApp, ref } from "@/index";
import { Text, VStack } from "@/view";
import type { KeyEvent } from "@/types";
import { sanitizeAnsi } from "@/renderer";
import { createMockPlatform, createMockTerminal, resetTestState } from "./helpers";

describe("Counter Debug Test", () => {
  beforeAll(() => Bun.gc(true));

  beforeEach(() => {
    resetTestState();
  });

  it("should render counter", async () => {
    const terminal = createMockTerminal();
    const platform = createMockPlatform();

    const app = createApp({
      init({ onKey, setExitOutput, runtime }) {
        const count = ref(0);
        onKey((k: KeyEvent) => {
          setExitOutput(count.value.toString());
          if (k.name === "up") count.value++;
          if (k.name === "down") count.value--;
          if (k.name === "q") runtime.exit(0);
        });
        return { count };
      },
      render({ count }) {
        return VStack([Text("Counter"), Text(String(count.value))])
          .width("100%")
          .height("100%")
          .justify("center")
          .align("center");
      },
      terminal,
      platform,
    });

    console.log("[TEST] Before mount");
    await app.mount();
    console.log("[TEST] After mount");

    await Bun.sleep(300);

    console.log("[TEST] Terminal output:", JSON.stringify(terminal.output));
    console.log("[TEST] Sanitized output:", JSON.stringify(sanitizeAnsi(terminal.output)));
    console.log("[TEST] Terminal write calls:", terminal.calls.write);

    // Just check it rendered something
    expect(terminal.calls.write).toBeGreaterThan(0);
    expect(sanitizeAnsi(terminal.output)).toContain("0");

    app.unmount();
  });
});
