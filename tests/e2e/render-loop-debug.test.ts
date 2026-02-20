import { describe, it, expect, beforeEach } from "bun:test";
import { createRenderer } from "@/runtime/render-loop";
import { Text, VStack, resetDirtyTracking } from "@/view";

describe("Render Loop Debug", () => {
  beforeEach(() => {
    resetDirtyTracking();
  });

  it("should render basic view", async () => {
    let capturedOutput = "";

    const renderer = createRenderer({
      getSize: () => ({ rows: 24, cols: 80 }),
      write: (output: string) => {
        console.log("[RENDER] Write called with:", JSON.stringify(output));
        capturedOutput += output;
      },
      view: () =>
        VStack([Text("Hello"), Text("World")])
          .width("100%")
          .height("100%"),
      getState: () => ({}),
      handleError: (ctx) => console.error("[ERROR]", ctx),
    });

    console.log("[TEST] Creating effect...");
    const effect = renderer.render({ forceFullRedraw: true });
    console.log("[TEST] Effect created:", effect ? "yes" : "no");

    // Wait for render
    await Bun.sleep(100);

    console.log("[TEST] Captured output:", JSON.stringify(capturedOutput));
    expect(capturedOutput.length).toBeGreaterThan(0);
  });
});
