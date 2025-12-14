import { describe, it, expect } from "bun:test";
import { Block } from "../../../src/view/primitives/block";
import { Text } from "../../../src/view/primitives/text";

describe("Block Primitive", () => {
  it("should create a BlockElement", () => {
    const block = Block();
    const element = block.build();
    expect(element.type).toBe("block");
    expect(element.style?.display).toBe("flex");
  });

  it("should add children", () => {
    const text = Text({ value: "hello" });
    const block = Block(text);
    const element = block.build();

    expect(element.children).toBeDefined();
    expect(element.children?.[0]?.type).toBe("text");
  });

  it("should set flexbox direction", () => {
    const block = Block().direction("row-reverse");
    const element = block.build();
    expect(element.style?.flexDirection).toBe("row-reverse");
  });

  it("should set flexbox justification", () => {
    const block = Block().justify("center");
    const element = block.build();
    expect(element.style?.justifyContent).toBe("center");
  });

  it("should set flexbox alignment", () => {
    const block = Block().align("stretch");
    const element = block.build();
    expect(element.style?.alignItems).toBe("stretch");
  });

  it("should chain methods", () => {
    const block = Block().direction("column").justify("space-between").align("center");
    const element = block.build();
    expect(element.style?.flexDirection).toBe("column");
    expect(element.style?.justifyContent).toBe("space-between");
    expect(element.style?.alignItems).toBe("center");
  });
});
