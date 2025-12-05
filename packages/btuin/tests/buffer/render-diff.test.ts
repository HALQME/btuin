import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createBuffer, cloneBuffer, renderDiff, drawText } from "../../src/buffer";
import { interceptTTY } from "../helpers/tty";

describe("renderDiff", () => {
  let activeTTY: ReturnType<typeof interceptTTY> | null = null;

  beforeEach(() => {
    // Ensure any previous TTY interception is cleaned up
    if (activeTTY) {
      activeTTY.restore();
      activeTTY = null;
    }
  });

  afterEach(() => {
    // Clean up TTY interception after each test
    if (activeTTY) {
      activeTTY.restore();
      activeTTY = null;
    }
  });
  it("writes only changed cells", () => {
    activeTTY = interceptTTY();
    const prev = createBuffer(2, 6);
    const next = cloneBuffer(prev);
    drawText(next, 0, 0, "abc");

    renderDiff(prev, next);

    const output = activeTTY.output();
    expect(output).toContain("a");
  });

  it("handles buffer size mismatch (resize scenario)", () => {
    activeTTY = interceptTTY();

    // Simulate initial buffer (small)
    const prev = createBuffer(10, 40);
    drawText(prev, 0, 0, "Old content");

    // Simulate resized buffer (larger)
    const next = createBuffer(20, 80);
    drawText(next, 0, 0, "New content after resize");

    // Should not throw when buffer sizes differ
    expect(() => renderDiff(prev, next)).not.toThrow();

    // Verify something was rendered
    const output = activeTTY.output();
    expect(output.length).toBeGreaterThan(0);
  });

  it("forces full redraw when buffer sizes differ", () => {
    activeTTY = interceptTTY();

    // Create different sized buffers
    const prev = createBuffer(5, 20);
    drawText(prev, 0, 0, "unchanged");

    const next = createBuffer(10, 40);
    drawText(next, 0, 0, "unchanged");

    renderDiff(prev, next);

    const output = activeTTY.output();
    // Size difference forces redraw - verify output was generated
    expect(output.length).toBeGreaterThan(0);
  });

  it("handles buffer shrinking correctly", () => {
    activeTTY = interceptTTY();

    // Large buffer
    const prev = createBuffer(30, 100);
    drawText(prev, 0, 0, "Some text");

    // Smaller buffer (terminal shrunk)
    const next = createBuffer(15, 50);
    drawText(next, 0, 0, "Text");

    expect(() => renderDiff(prev, next)).not.toThrow();

    // Verify rendering completed without errors
    const output = activeTTY.output();
    expect(output.length).toBeGreaterThan(0);
  });
});
