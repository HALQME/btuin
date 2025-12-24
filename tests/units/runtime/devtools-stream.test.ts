import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { app } from "@/runtime/app";
import { Block, Text } from "@/view/primitives";
import { disposeSingletonCapture, patchConsole, stopCapture } from "@/terminal/capture";
import type { TerminalAdapter } from "@/types";
import net from "node:net";

describe("devtools stream", () => {
  const filePath = join(tmpdir(), `btuin-devtools-${Date.now()}-${Math.random()}.log`);

  const keyHandlers: any[] = [];
  const terminal: TerminalAdapter = {
    setBracketedPaste: () => {},
    setupRawMode: () => {},
    clearScreen: () => {},
    moveCursor: () => {},
    cleanupWithoutClear: () => {},
    patchConsole: () => () => {},
    startCapture: () => {},
    stopCapture: () => {},
    onKey: (callback: any) => {
      keyHandlers.push(callback);
    },
    getTerminalSize: () => ({ rows: 10, cols: 40 }),
    disposeSingletonCapture,
    write: () => {},
  };
  const platform = {
    onStdoutResize: () => () => {},
    onExit: () => {},
    onSigint: () => {},
    onSigterm: () => {},
    exit: () => {},
  };

  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  beforeEach(() => {
    keyHandlers.length = 0;
    process.stdout.write = (() => true) as any;
    process.stderr.write = (() => true) as any;
    try {
      rmSync(filePath, { force: true });
    } catch {}
  });

  afterEach(() => {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    try {
      disposeSingletonCapture();
    } catch {}
    try {
      stopCapture();
    } catch {}
    try {
      rmSync(filePath, { force: true });
    } catch {}
  });

  it("should write captured console logs as JSONL to file", async () => {
    const unpatch = patchConsole();
    const inst = app({
      terminal,
      platform,
      devtools: { enabled: true, stream: { file: filePath } },
      init: () => ({}),
      render: () => Block(Text("X")),
    });

    await inst.mount({ rows: 10, cols: 40 });
    console.log("hello");
    inst.unmount();
    unpatch();

    const content = readFileSync(filePath, "utf8");
    const first = content.split("\n").find(Boolean);
    expect(first).toBeTruthy();
    const parsed = JSON.parse(first!);
    expect(parsed.text).toBe("hello");
    expect(parsed.type).toBe("stdout");
    expect(typeof parsed.timestamp).toBe("number");
  });

  it("should stream captured console logs as JSONL over TCP", async () => {
    const unpatch = patchConsole();

    let listenInfo: { host: string; port: number } | null = null;
    const inst = app({
      terminal,
      platform,
      devtools: {
        enabled: true,
        stream: {
          tcp: {
            host: "127.0.0.1",
            port: 0,
            onListen: (info) => {
              listenInfo = info;
            },
          },
        },
      },
      init: () => ({}),
      render: () => Block(Text("X")),
    });

    try {
      await inst.mount({ rows: 10, cols: 40 });

      for (let i = 0; i < 50 && !listenInfo; i++) {
        await new Promise((r) => setTimeout(r, 10));
      }

      // Some sandboxed environments prohibit binding to TCP ports (EPERM).
      // In that case, treat as a no-op and skip assertions.
      if (!listenInfo) return;

      const received = await new Promise<string>((resolve, reject) => {
        const socket = net.connect({ host: listenInfo!.host, port: listenInfo!.port }, () => {
          socket.setEncoding("utf8");
          console.log("hello");
        });

        let buf = "";
        const timer = setTimeout(() => {
          try {
            socket.destroy();
          } catch {}
          reject(new Error("timeout waiting for TCP log line"));
        }, 500);

        socket.on("data", (chunk) => {
          buf += chunk;
          const line = buf.split("\n").find(Boolean);
          if (line) {
            clearTimeout(timer);
            try {
              socket.destroy();
            } catch {}
            resolve(line);
          }
        });
        socket.on("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      const parsed = JSON.parse(received);
      expect(parsed.text).toBe("hello");
      expect(parsed.type).toBe("stdout");
      expect(typeof parsed.timestamp).toBe("number");
    } finally {
      inst.unmount();
      unpatch();
    }
  });
});
