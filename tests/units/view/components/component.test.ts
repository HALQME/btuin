import { describe, it, expect } from "bun:test";
import {
  defineComponent,
  isComponent,
  mountComponent,
  unmountComponent,
  renderComponent,
  handleComponentKey,
} from "@/components/component";
import { onKey, onMounted } from "@/components/lifecycle";
import { inject, provide, type InjectionKey } from "@/components/provide-inject";
import { Block, Text } from "@/view/primitives";

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

describe("provide/inject", () => {
  it("should provide values to nested components (string key)", () => {
    const Child = defineComponent({
      setup() {
        const value = inject<number>("foo");
        return () => Text(String(value));
      },
    });

    let didMount = false;
    const Parent = defineComponent({
      setup() {
        provide("foo", 42);
        const mountedChild = mountComponent(Child);

        // This should still work even though we mounted a child during setup.
        // (Requires currentInstance stack behavior.)
        onMounted(() => {
          didMount = true;
        });

        return () => renderComponent(mountedChild);
      },
    });

    const mountedParent = mountComponent(Parent);
    const element = renderComponent(mountedParent);
    expect(didMount).toBe(true);

    expect(element.type).toBe("text");
    if (element.type === "text") {
      expect(element.content).toBe("42");
    }
  });

  it("should provide values to nested components (symbol key)", () => {
    const key = Symbol("answer") as InjectionKey<number>;

    const Child = defineComponent({
      setup() {
        const value = inject(key);
        return () => Text(String(value));
      },
    });

    const Parent = defineComponent({
      setup() {
        provide(key, 123);
        const mountedChild = mountComponent(Child);
        return () => renderComponent(mountedChild);
      },
    });

    const mountedParent = mountComponent(Parent);
    const element = renderComponent(mountedParent);

    expect(element.type).toBe("text");
    if (element.type === "text") {
      expect(element.content).toBe("123");
    }
  });

  it("should return default values when injection is missing", () => {
    const Comp = defineComponent({
      setup() {
        const value = inject("missing", "default");
        return () => Text(value);
      },
    });

    const mounted = mountComponent(Comp);
    const element = renderComponent(mounted);
    expect(element.type).toBe("text");
    if (element.type === "text") {
      expect(element.content).toBe("default");
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

  it("should traverse view hierarchy and honor stopPropagation", () => {
    const order: string[] = [];

    const component = defineComponent({
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
