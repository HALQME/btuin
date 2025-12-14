import { describe, expect, test } from "bun:test";
import { Spacer } from "../../../src/view/primitives";

describe("Spacer Primitive", () => {
  test("should create an empty BlockElement that grows", () => {
    const el = Spacer(2).build();
    expect(el.type).toBe("block");
    expect(el.children.length).toBe(0);
    expect(el.style.flexGrow).toBe(2);
    expect(el.style.flexShrink).toBe(1);
    expect(el.style.flexBasis).toBe(0);
  });
});

