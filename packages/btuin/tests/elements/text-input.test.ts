import { describe, it, expect } from "bun:test";
import { createBuffer } from "../../src/buffer";
import { renderElement } from "../../src/layout";
import { TextInput, isInput } from "../../src/elements";
import { bufferToLines } from "../helpers/buffer";

describe("TextInput rendering", () => {
  it("renders placeholder text when not focused", () => {
    const element = TextInput({
      value: "",
      placeholder: "type",
      focusKey: "input",
    });
    const rect = { x: 0, y: 0, width: 5, height: 1 };
    const buf = createBuffer(rect.height, rect.width);

    renderElement({ ...element, rect }, buf, {});

    expect(bufferToLines(buf)[0]).toBe("type ");
  });

  it("renders value and cursor when focused", () => {
    const element = TextInput({
      value: "abcd",
      cursor: 2,
      focusKey: "input",
    });
    const rect = { x: 0, y: 0, width: 6, height: 1 };
    const buf = createBuffer(rect.height, rect.width);

    renderElement({ ...element, rect }, buf, { activeFocusKey: "input" });

    const line = bufferToLines(buf)[0];
    expect(line).toBe("ab▌d  ");
  });

  it("clamps cursor to buffer bounds", () => {
    const element = TextInput({
      value: "hi",
      cursor: 10,
      focusKey: "input",
    });
    const rect = { x: 0, y: 0, width: 3, height: 1 };
    const buf = createBuffer(rect.height, rect.width);

    renderElement({ ...element, rect }, buf, { activeFocusKey: "input" });

    const line = bufferToLines(buf)[0] ?? "";
    expect(line[2]).toBe("▌");
  });
});
