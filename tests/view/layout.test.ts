import { describe, it, expect } from "bun:test";
import { VStack, HStack } from "../../src/view/layout";
import { Text } from "../../src/view/primitives";

describe("Layout Components", () => {
  describe("VStack", () => {
    it("should create a Block with column direction", () => {
      const vstack = VStack([Text({ value: "hello" })]);
      const element = vstack.build();

      expect(element.type).toBe("block");
      expect(element.style?.flexDirection).toBe("column");
      expect(element.children?.[0]?.type).toBe("text");
    });
  });

  describe("HStack", () => {
    it("should create a Block with row direction", () => {
      const hstack = HStack([Text({ value: "world" })]);
      const element = hstack.build();

      expect(element.type).toBe("block");
      expect(element.style?.flexDirection).toBe("row");
      expect(element.style?.alignItems).toBe("center");
      expect(element.children?.[0]?.type).toBe("text");
    });
  });
});
