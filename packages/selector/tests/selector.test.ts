import { describe, it, expect } from "bun:test";
import { Selector } from "../src";

describe("Selector", () => {
  it("creates element with options", () => {
    const element = Selector({ options: [{ label: "a", value: "a" }] });
    expect(element.type).toBe("selector");
  });
});
