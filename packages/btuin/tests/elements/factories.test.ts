import { describe, it, expect } from "bun:test";
import { Box, Paragraph, TextInput, isBox, isParagraph, isInput } from "../../src/elements";

describe("component factories", () => {
  it("creates box elements with merged props", () => {
    const child = Paragraph({ text: "child" });
    const element = Box({ child, outline: { title: "box" }, focusKey: "root" });

    expect(isBox(element)).toBe(true);
    if (!isBox(element)) throw new Error("expected box element");
    expect(element.child).toBe(child);
    expect(element.outline?.title).toBe("box");
    expect(element.focusKey).toBe("root");
  });

  it("creates paragraph elements with text options", () => {
    const element = Paragraph({
      text: "hello",
      wrap: false,
      align: "center",
      color: "magenta",
      width: 10,
      height: 3,
    });

    if (isParagraph(element)) {
      expect(element.text).toBe("hello");
      expect(element.align).toBe("center");
      expect(element.wrap).toBe(false);
      expect(element.width).toBe(10);
      expect(element.height).toBe(3);
    }
  });

  it("creates text input elements", () => {
    const element = TextInput({
      value: "abc",
      placeholder: "type",
      cursor: 2,
      focusKey: "input",
    });

    if (isInput(element)) {
      expect(element.value).toBe("abc");
      expect(element.placeholder).toBe("type");
      expect(element.cursor).toBe(2);
      expect(element.focusKey).toBe("input");
    }
  });
});
