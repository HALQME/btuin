import { describe, it, expect } from "bun:test";
import { Spinner, type SpinnerElement } from "../src/spinner";

describe("Spinner", () => {
  it("creates element with default props", () => {
    const element = Spinner({ focusKey: "test-spinner" }) as SpinnerElement;
    expect(element.type).toBe("spinner");
  });

  it("supports custom text", () => {
    const element = Spinner({
      text: "Processing...",
      focusKey: "test-spinner",
    }) as SpinnerElement;
    expect(element.text).toBe("Processing...");
  });

  it("supports width and height", () => {
    const element = Spinner({
      width: 30,
      height: 1,
      focusKey: "test-spinner",
    }) as SpinnerElement;
    expect(element.width).toBe(30);
    expect(element.height).toBe(1);
  });

  it("handles focus key", () => {
    const element = Spinner({
      focusKey: "custom-spinner-key",
    }) as SpinnerElement;
    expect(element.focusKey).toBe("custom-spinner-key");
  });

  it("creates element without required props", () => {
    const element = Spinner({}) as SpinnerElement;
    expect(element.type).toBe("spinner");
  });

  it("supports outline configuration", () => {
    const element = Spinner({
      outline: { style: "single" },
      focusKey: "test-spinner",
    }) as SpinnerElement;
    expect(element.outline?.style).toBe("single");
  });

  it("handles multiple spinner instances", () => {
    const spinner1 = Spinner({
      focusKey: "spinner-1",
      text: "Loading 1",
    }) as SpinnerElement;

    const spinner2 = Spinner({
      focusKey: "spinner-2",
      text: "Loading 2",
    }) as SpinnerElement;

    expect(spinner1.focusKey).toBe("spinner-1");
    expect(spinner2.focusKey).toBe("spinner-2");
    expect(spinner1.text).toBe("Loading 1");
    expect(spinner2.text).toBe("Loading 2");
  });
});
