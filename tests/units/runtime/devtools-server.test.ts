import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { createConsoleCapture } from "@/terminal/capture";
import { setupDevtoolsServer } from "@/devtools/server";
import { Block, Text } from "@/view/primitives";
import type { ComputedLayout } from "@/layout-engine/types";

describe("DevTools browser server", () => {
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  beforeEach(() => {
    process.stdout.write = (() => true) as any;
    process.stderr.write = (() => true) as any;
  });

  afterEach(() => {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  });

  it("should serve HTML and stream logs over WebSocket", async () => {
    const capture = createConsoleCapture({ maxLines: 50 });

    const server = setupDevtoolsServer(
      {
        enabled: true,
        server: {
          host: "127.0.0.1",
          port: 0,
        },
      },
      () => capture,
    );

    try {
      // Some sandboxed environments prohibit binding to ports (EPERM).
      const listenInfo = server?.getInfo();
      if (!listenInfo) return;

      const res = await fetch(listenInfo.url);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("btuin DevTools");

      const wsUrl = listenInfo.url.replace(/^http/, "ws") + "/ws";

      const received = await new Promise<any>((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        const timer = setTimeout(() => reject(new Error("timeout")), 1000);

        ws.addEventListener("open", () => {
          process.stdout.write("hello\n");
        });
        ws.addEventListener("message", (ev) => {
          try {
            const msg = JSON.parse(String(ev.data));
            if (msg?.type === "log" && msg?.line?.text === "hello") {
              clearTimeout(timer);
              try {
                ws.close();
              } catch {}
              resolve(msg);
            }
          } catch {
            // ignore
          }
        });
        ws.addEventListener("error", (e) => {
          clearTimeout(timer);
          reject(e);
        });
      });

      expect(received.type).toBe("log");
      expect(received.line.text).toBe("hello");
      expect(received.line.type).toBe("stdout");

      const root = Block(Text("X").setKey("child")).setKey("root");
      const layoutMap: ComputedLayout = {
        root: { x: 0, y: 0, width: 10, height: 3 },
        child: { x: 1, y: 1, width: 1, height: 1 },
      };
      server?.setSnapshot({ size: { rows: 10, cols: 40 }, rootElement: root, layoutMap });
    } finally {
      try {
        server?.dispose();
      } catch {}
      capture.dispose();
    }
  });
});
