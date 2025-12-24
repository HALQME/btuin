import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createComponent, mountComponent, unmountComponent } from "@/components";
import { Block } from "@/view/primitives";
import {
  patchConsole,
  startCapture,
  stopCapture,
  disposeSingletonCapture,
} from "@/terminal/capture";
import { useLog, type UseLogResult } from "@/hooks/use-log";

describe("useLog", () => {
  let originalStdoutWrite: typeof process.stdout.write;
  let originalStderrWrite: typeof process.stderr.write;

  beforeEach(() => {
    originalStdoutWrite = process.stdout.write;
    originalStderrWrite = process.stderr.write;
    process.stdout.write = (() => true) as any;
    process.stderr.write = (() => true) as any;
  });

  afterEach(() => {
    try {
      disposeSingletonCapture();
    } catch {}
    try {
      stopCapture();
    } catch {}
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  });

  it("should update lines when console output is captured", () => {
    const unpatch = patchConsole();
    startCapture();

    let log: UseLogResult | null = null;
    const Comp = createComponent({
      init: () => {
        log = useLog({ maxLines: 50 });
      },
      render: () => Block(),
    });

    const mounted = mountComponent(Comp);

    console.log("hello");

    expect(log).not.toBeNull();
    expect(log!.lines.value.at(-1)?.text).toBe("hello");
    expect(log!.lines.value.at(-1)?.type).toBe("stdout");

    unmountComponent(mounted);
    unpatch();
  });
});
