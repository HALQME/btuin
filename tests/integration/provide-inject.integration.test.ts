import { describe, it, expect } from "bun:test";
import { createApp, defineComponent, inject, provide } from "@/index";
import { mountComponent, renderComponent } from "@/components";
import { Text } from "@/view/primitives";
import { createMockPlatform, createMockTerminal } from "../e2e/helpers";

function stripAnsi(input: string): string {
  return input.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
}

describe("Framework integration: provide/inject context passing", () => {
  it("passes context across nested component mounts and supports shadowing", async () => {
    const terminal = createMockTerminal();
    const platform = createMockPlatform();

    const Grandchild = defineComponent({
      setup() {
        const fromRoot = inject<string>("fromRoot", "missing");
        const fromChild = inject<string>("fromChild", "missing");
        return () => Text(`CTX=${fromRoot}:${fromChild}`);
      },
    });

    const Child = defineComponent({
      setup() {
        const fromRoot = inject<string>("fromRoot", "missing");
        provide("fromChild", `${fromRoot}-child`);
        const mountedGrandchild = mountComponent(Grandchild);
        return () => renderComponent(mountedGrandchild);
      },
    });

    const app = createApp({
      terminal,
      platform,
      init() {
        provide("fromRoot", "root");
        const mountedChild = mountComponent(Child);
        return { mountedChild };
      },
      render: ({ mountedChild }) => renderComponent(mountedChild),
    });

    await app.mount();
    await Bun.sleep(50);

    expect(stripAnsi(terminal.output)).toContain("CTX=root:root-child");

    app.unmount();
  });
});
