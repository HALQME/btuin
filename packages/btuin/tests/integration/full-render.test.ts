import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createBuffer, cloneBuffer, renderDiff } from "../../src/buffer";
import { layout, renderElement } from "../../src/layout";
import { VStack, Paragraph } from "../../src/elements";
import { enableTestMode, disableTestMode } from "../../src/terminal";
import { bufferToLines } from "../helpers/buffer";

describe("Full rendering cycle", () => {
  beforeEach(() => {
    enableTestMode();
  });

  afterEach(() => {
    disableTestMode();
  });

  it("renders a simple view from state", () => {
    interface State {
      message: string;
    }

    const state: State = { message: "Hello, World!" };

    const view = () => ({
      type: "paragraph" as const,
      text: state.message,
    });

    const buf = createBuffer(5, 20);
    const rect = { x: 0, y: 0, width: 20, height: 5 };
    const element = view();
    const laidOut = layout(element, rect);

    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    expect(lines[0]).toContain("Hello, World!");
  });

  it("renders nested layout structure", () => {
    const view = VStack({
      children: [
        Paragraph({ text: "Header" }),
        Paragraph({ text: "Content" }),
        Paragraph({ text: "Footer" }),
      ],
    });

    const buf = createBuffer(10, 30);
    const rect = { x: 0, y: 0, width: 30, height: 10 };
    const laidOut = layout(view, rect);

    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    const text = lines.join("");
    expect(text).toContain("Header");
    expect(text).toContain("Content");
    expect(text).toContain("Footer");
  });

  it("performs diff rendering between frames", () => {
    const prev = createBuffer(5, 20);
    const next = cloneBuffer(prev);

    // Modify next buffer
    const view = Paragraph({ text: "New Content" });
    const rect = { x: 0, y: 0, width: 20, height: 5 };
    const laidOut = layout(view, rect);
    renderElement(laidOut, next, {});

    // Should not throw
    expect(() => renderDiff(prev, next)).not.toThrow();
  });

  it("handles state updates and re-rendering", () => {
    interface State {
      count: number;
    }

    let state: State = { count: 0 };

    const view = (s: State) => ({
      type: "paragraph" as const,
      text: `Count: ${s.count}`,
    });

    // Initial render
    const buf1 = createBuffer(3, 20);
    const rect = { x: 0, y: 0, width: 20, height: 3 };
    const laidOut1 = layout(view(state), rect);
    renderElement(laidOut1, buf1, {});

    const lines1 = bufferToLines(buf1);
    expect(lines1[0]).toContain("Count: 0");

    // Update state
    state = { count: state.count + 1 };

    // Re-render
    const buf2 = createBuffer(3, 20);
    const laidOut2 = layout(view(state), rect);
    renderElement(laidOut2, buf2, {});

    const lines2 = bufferToLines(buf2);
    expect(lines2[0]).toContain("Count: 1");
  });

  it("renders complex nested structure", () => {
    const view = VStack({
      gap: 1,
      children: [
        Paragraph({ text: "=== Title ===", align: "center" }),
        VStack({
          children: [
            Paragraph({ text: "Item 1" }),
            Paragraph({ text: "Item 2" }),
            Paragraph({ text: "Item 3" }),
          ],
        }),
        Paragraph({ text: "Footer", align: "right" }),
      ],
    });

    const buf = createBuffer(15, 40);
    const rect = { x: 0, y: 0, width: 40, height: 15 };
    const laidOut = layout(view, rect);

    renderElement(laidOut, buf, {});

    const lines = bufferToLines(buf);
    const text = lines.join("\n");

    expect(text).toContain("Title");
    expect(text).toContain("Item 1");
    expect(text).toContain("Item 2");
    expect(text).toContain("Item 3");
    expect(text).toContain("Footer");
  });
});
