import { describe, it, expect, beforeEach } from "bun:test";
import {
  defineComponent,
  isComponent,
  mountComponent,
  unmountComponent,
  renderComponent,
  handleComponentKey,
} from "../../../src/view/components/component";
import type { Component, RenderFunction } from "../../../src/view/components/component";
import { onKey } from "../../../src/view/components/lifecycle";
import { ref } from "@btuin/reactivity";
import { Text } from "../../../src/view/primitives";

describe("defineComponent", () => {
  it("should define a component", () => {
    const component = defineComponent({
      name: "TestComponent",
      setup() {
        return () => Text("Hello");
      },
    });

    expect(isComponent(component)).toBe(true);
    expect(component.options.name).toBe("TestComponent");
  });

  it("should return a render function from setup", () => {
    const component = defineComponent({
      setup() {
        return () => Text("Hello");
      },
    });

    const mounted = mountComponent(component);
    const element = renderComponent(mounted);

    expect(element.type).toBe("text");
    if (element.type === "text") {
      expect(element.content).toBe("Hello");
    }
  });
});

describe("mountComponent", () => {
  it("should mount and unmount a component", () => {
    const component = defineComponent({
      setup() {
        return () => Text("Hello");
      },
    });

    const mounted = mountComponent(component);
    expect(mounted).toBeDefined();
    expect(mounted.instance.isMounted).toBe(true);

    unmountComponent(mounted);
    expect(mounted.instance.isMounted).toBe(false);
  });
});

describe("handleComponentKey", () => {
  it("should handle key events", () => {
    let keyPressed = "";
    const component = defineComponent({
      setup() {
        onKey((key) => {
          keyPressed = key.name;
        });
        return () => Text("Hello");
      },
    });

    const mounted = mountComponent(component);
    handleComponentKey(mounted, {
      name: "a",
      sequence: "a",
      ctrl: false,
      meta: false,
      shift: false,
    });

    expect(keyPressed).toBe("a");
  });
});

describe("normalizeProps", () => {
  it("should normalize props", () => {
    const component = defineComponent({
      props: {
        name: { type: String, required: true },
        age: { type: Number, default: 20 },
        validator: { validator: (v) => v > 0 },
      },
      setup(props) {
        return () => Text(`Name: ${props.name}, Age: ${props.age}`);
      },
    });

    const mounted = mountComponent(component, { name: "John", validator: 10 });
    const element = renderComponent(mounted);
    expect(element.type).toBe("text");
    if (element.type === "text") {
      expect(element.content).toBe("Name: John, Age: 20");
    }
  });
});
