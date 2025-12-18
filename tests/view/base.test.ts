import { describe, it, expect } from "bun:test";
import { BaseView } from "../../src/view/base";
import type { OutlineOptions } from "@/renderer/types";

// A concrete class for testing the abstract BaseView
class ConcreteView extends BaseView {
  type = "concrete";
}

describe("BaseView", () => {
  it("should construct with initial props", () => {
    const props = {
      key: "my-key",
      focusKey: "my-focus-key",
      style: {
        width: 100,
        background: "blue",
      },
    };
    const view = new ConcreteView(props);
    const element = view.build();

    expect(element.key).toBe("my-key");
    expect(element.focusKey).toBe("my-focus-key");
    expect(element.style?.width).toBe(100);
    expect(element.style?.background).toBe("blue");
  });

  it("should set width", () => {
    const view = new ConcreteView().width(200);
    const element = view.build();
    expect(element.style?.width).toBe(200);
  });

  it("should set height", () => {
    const view = new ConcreteView().height(50);
    const element = view.build();
    expect(element.style?.height).toBe(50);
  });

  it("should set gap", () => {
    const view = new ConcreteView().gap(10);
    const element = view.build();
    expect(element.style?.gap).toBe(10);
  });

  it("should set foreground color", () => {
    const view = new ConcreteView().foreground("red");
    const element = view.build();
    expect(element.style?.foreground).toBe("red");
  });

  it("should set background color", () => {
    const view = new ConcreteView().background(0x0000ff);
    const element = view.build();
    expect(element.style?.background).toBe(0x0000ff);
  });

  it("should set outline", () => {
    const outline: OutlineOptions = { style: "double", color: "green" };
    const view = new ConcreteView().outline(outline);
    const element = view.build();
    expect(element.style?.outline).toEqual(outline);
  });

  it("should set focus key", () => {
    const view = new ConcreteView().focus("input-1");
    const element = view.build();
    expect(element.focusKey).toBe("input-1");
  });

  it("should chain methods", () => {
    const view = new ConcreteView().width(10).height(20).background("yellow").focus("test-focus");

    const element = view.build();
    expect(element.style?.width).toBe(10);
    expect(element.style?.height).toBe(20);
    expect(element.style?.background).toBe("yellow");
    expect(element.focusKey).toBe("test-focus");
  });
});
