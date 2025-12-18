import { describe, it, expect, beforeEach } from "bun:test";
import {
  btuin,
  isComponent,
  mountComponent,
  unmountComponent,
  renderComponent,
  handleComponentKey,
} from "@/view/components/component";
import type { Component, RenderFunction } from "@/view/components/component";
import { onKey } from "../../../src/view/components/lifecycle";
import { ref } from "@/reactivity";
import { Block, Text } from "../../../src/view/primitives";

describe("defineComponent", () => {
  it("should define a component", () => {
    const component = btuin({
      name: "TestComponent",
      setup() {
        return () => Text("Hello");
      },
    });

    expect(isComponent(component)).toBe(true);
    expect(component.options.name).toBe("TestComponent");
  });

  it("should return a render function from setup", () => {
    const component = btuin({
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
    const component = btuin({
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
    const component = btuin({
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

  it("should traverse view hierarchy and honor stopPropagation", () => {
    const order: string[] = [];

    const component = btuin({
      setup() {
        onKey(() => {
          order.push("component");
        });

        const child = Block().onKey(() => {
          order.push("child");
          return true;
        });

        const parent = Block(child).onKey(() => {
          order.push("parent");
          return true;
        });

        return () => parent;
      },
    });

    const mounted = mountComponent(component);
    renderComponent(mounted);

    const handled = handleComponentKey(mounted, {
      name: "a",
      sequence: "a",
      ctrl: false,
      meta: false,
      shift: false,
    });

    expect(handled).toBe(true);
    expect(order).toEqual(["child"]);
  });
});

describe("normalizeProps", () => {
  it("should normalize props", () => {
    const component = btuin({
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
