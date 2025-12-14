import { describe, it, expect } from "bun:test";
import { isBlock, isText } from "../../../src/view/types/elements";
import type { ViewElement, BlockView, TextView } from "../../../src/view/types/elements";
import { BaseView } from "../../../src/view/base";

// Mock implementations for testing
class MockBlock extends BaseView implements BlockView {
  type = "block" as const;
  children = [];
}
class MockText extends BaseView implements TextView {
  type = "text" as const;
  content = "";
}

class MockOther extends BaseView {
  type = "other" as const;
}

describe("Element Type Guards", () => {
  it("should correctly identify a Block element", () => {
    const blockElement = new MockBlock() as any;
    const textElement = new MockText() as any;
    const otherElement = new MockOther() as any;

    expect(isBlock(blockElement)).toBe(true);
    expect(isBlock(textElement)).toBe(false);
    expect(isBlock(otherElement)).toBe(false);
  });

  it("should correctly identify a Text element", () => {
    const blockElement = new MockBlock() as any;
    const textElement = new MockText() as any;
    const otherElement = new MockOther() as any;

    expect(isText(textElement)).toBe(true);
    expect(isText(blockElement)).toBe(false);
    expect(isText(otherElement)).toBe(false);
  });
});
