import { describe, it, expect, afterEach, beforeAll } from "bun:test";
import { Block, Text } from "@/view/primitives";
import type { AppType as App, TerminalAdapter } from "@/types";

describe("inline mode output passthrough", () => {
  let appInstance: App;
  let app: typeof import("@/runtime/app").app;

  afterEach(() => {
    appInstance?.unmount();
  });

  beforeAll(async () => {
    ({ app } = await import("@/runtime/app"));
  });

  it("clears UI, prints stdout, then re-renders", async () => {
    const events: Array<{ type: "ui" | "stdout"; text: string }> = [];
    let stdoutListener: ((text: string) => void) | undefined;

    const terminal: TerminalAdapter = {
      setBracketedPaste: () => {},
      setupRawMode: () => {},
      clearScreen: () => {},
      moveCursor: () => {},
      cleanupWithoutClear: () => {},
      patchConsole: () => () => {},
      startCapture: () => {},
      stopCapture: () => {},
      onStdout: (handler) => {
        stdoutListener = handler;
        return () => {
          if (stdoutListener === handler) stdoutListener = undefined;
        };
      },
      writeStdout: (text) => {
        events.push({ type: "stdout", text });
      },
      onKey: () => {},
      getTerminalSize: () => ({ rows: 24, cols: 80 }),
      disposeSingletonCapture: () => {},
      write: (output: string) => {
        events.push({ type: "ui", text: output });
      },
    };

    const platform = {
      onStdoutResize: () => () => {},
      onExit: () => {},
      onSigint: () => {},
      onSigterm: () => {},
      exit: () => {},
    };

    appInstance = app({
      terminal,
      platform,
      init() {
        return {};
      },
      render() {
        return Block(Text("A"), Text("B")).direction("column");
      },
    });

    await appInstance.mount({ rows: 3, cols: 5, inline: true });
    expect(typeof stdoutListener).toBe("function");

    const before = events.length;
    stdoutListener!("hello\n");

    expect(events.slice(before, before + 2).map((e) => e.type)).toEqual(["ui", "stdout"]);
    expect(events[before]?.text.length).toBeGreaterThan(0);
    expect(events[before + 1]?.text).toBe("hello\n");

    await Promise.resolve();
    const after = events.length;
    expect(after).toBeGreaterThan(before + 2);
    expect(events.slice(before + 2).some((e) => e.type === "ui")).toBe(true);
  });

  it("coalesces multiple stdout writes into a single clear+rerender cycle", async () => {
    const events: Array<{ type: "ui" | "stdout"; text: string }> = [];
    let stdoutListener: ((text: string) => void) | undefined;

    const terminal: TerminalAdapter = {
      setBracketedPaste: () => {},
      setupRawMode: () => {},
      clearScreen: () => {},
      moveCursor: () => {},
      cleanupWithoutClear: () => {},
      patchConsole: () => () => {},
      startCapture: () => {},
      stopCapture: () => {},
      onStdout: (handler) => {
        stdoutListener = handler;
        return () => {
          if (stdoutListener === handler) stdoutListener = undefined;
        };
      },
      writeStdout: (text) => {
        events.push({ type: "stdout", text });
      },
      onKey: () => {},
      getTerminalSize: () => ({ rows: 24, cols: 80 }),
      disposeSingletonCapture: () => {},
      write: (output: string) => {
        events.push({ type: "ui", text: output });
      },
    };

    const platform = {
      onStdoutResize: () => () => {},
      onExit: () => {},
      onSigint: () => {},
      onSigterm: () => {},
      exit: () => {},
    };

    appInstance = app({
      terminal,
      platform,
      init() {
        return {};
      },
      render() {
        return Block(Text("A"), Text("B")).direction("column");
      },
    });

    await appInstance.mount({ rows: 3, cols: 5, inline: true });
    expect(typeof stdoutListener).toBe("function");

    const before = events.length;
    stdoutListener!("a");
    stdoutListener!("b");
    stdoutListener!("c\n");

    const slice = events.slice(before);
    const uiClears = slice.filter((e) => e.type === "ui");
    const stdoutWrites = slice.filter((e) => e.type === "stdout");
    expect(uiClears.length).toBe(1);
    expect(stdoutWrites.map((e) => e.text).join("")).toBe("abc\n");

    await Promise.resolve();
    const afterSlice = events.slice(before);
    const uiWritesTotal = afterSlice.filter((e) => e.type === "ui").length;
    expect(uiWritesTotal).toBe(2);
  });
});
