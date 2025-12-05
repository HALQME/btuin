import { describe, it, expect } from "bun:test";
import { createBuffer } from "../../src/buffer";
import { renderElement } from "../../src/layout";
import { bufferToLines } from "../helpers/buffer";
import { Paragraph } from "../../src/elements";

describe("renderElement", () => {
  it("renders paragraph text", () => {
    const element = Paragraph({ text: "hello" });
    const buf = createBuffer(1, 6);
    renderElement({ ...element, rect: { x: 0, y: 0, width: 6, height: 1 } }, buf, {});
    expect(bufferToLines(buf)[0]?.trim()).toBe("hello");
  });

  it("draws outlines when outline options are provided", () => {
    const element = Paragraph({ text: "yo", outline: {} });
    const rect = { x: 0, y: 0, width: 6, height: 3 };
    const innerRect = { x: 1, y: 1, width: 4, height: 1 };
    const buf = createBuffer(rect.height, rect.width);

    renderElement({ ...element, rect, innerRect }, buf, {});

    expect(bufferToLines(buf)).toEqual(["┌────┐", "│yo  │", "└────┘"]);
  });

  it("uses focus outline when active focus key matches", () => {
    const element = Paragraph({ text: "focus", focusKey: "name" });
    const rect = { x: 0, y: 0, width: 6, height: 3 };
    const innerRect = { x: 1, y: 1, width: 4, height: 1 };
    const buf = createBuffer(rect.height, rect.width);

    renderElement({ ...element, rect, innerRect }, buf, { activeFocusKey: "name" });

    expect(bufferToLines(buf)).toEqual(["┌────┐", "│focu│", "└────┘"]);
  });
});
