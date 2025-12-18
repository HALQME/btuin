import { describe, it, expect } from "bun:test";
import { Text } from "../../../src/view/primitives/text";

describe("Text Primitive", () => {
  it("should create a TextElement with the correct content", () => {
    const text = Text("hello world");
    const element = text.build();

    expect(element.type).toBe("text");
    expect(element.content).toBe("hello world");
  });

  // TODO: Add tests for `bold()` and other text styling methods
  // once they are implemented.
  it("should have a bold method (currently a placeholder)", () => {
    const text = Text("bold text").bold();
    const element = text.build();

    // For now, just assert it doesn't crash
    expect(element.type).toBe("text");
  });
});
