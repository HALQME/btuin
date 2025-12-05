import { describe, it, expect } from "bun:test";
import { createApp, ref, onKey, Paragraph } from "../../src/index";
import { interceptTTY } from "../helpers/tty";

type RestoreHandle = { restore(): void };

const ANSI_REGEX = /\x1b\[[0-9;?]*[A-Za-z]/g;

function stripAnsi(value: string) {
  return value.replace(ANSI_REGEX, "");
}

function trackProcessOnce(): RestoreHandle {
  const added: Array<{ event: string; listener: (...args: any[]) => void }> = [];
  const originalOnce = process.once;

  (process as any).once = function (event: string, listener: (...args: any[]) => void) {
    added.push({ event, listener });
    return originalOnce.call(process, event, listener);
  };

  return {
    restore() {
      (process as any).once = originalOnce;
      for (const { event, listener } of added) {
        process.off(event, listener);
      }
    },
  };
}

function enableRawStdin(): RestoreHandle {
  const stdin = process.stdin as any;
  const original = {
    isTTY: stdin.isTTY,
    setRawMode: stdin.setRawMode,
    resume: stdin.resume,
    pause: stdin.pause,
    setEncoding: stdin.setEncoding,
  };

  stdin.isTTY = true;
  if (!stdin.setRawMode) stdin.setRawMode = () => {};
  if (!stdin.resume) stdin.resume = () => {};
  if (!stdin.pause) stdin.pause = () => {};
  if (!stdin.setEncoding) stdin.setEncoding = () => {};

  return {
    restore() {
      stdin.isTTY = original.isTTY;
      stdin.setRawMode = original.setRawMode;
      stdin.resume = original.resume;
      stdin.pause = original.pause;
      stdin.setEncoding = original.setEncoding;
    },
  };
}

describe("Runtime integration", () => {
  it("mounts the app, renders via render loop, and reacts to terminal input", () => {
    const tty = interceptTTY();
    const onceTracker = trackProcessOnce();
    const stdinGuard = enableRawStdin();
    let app = createApp({
      setup() {
        const count = ref(0);
        onKey((event) => {
          if (event.name === "up") {
            count.value += 1;
            return true;
          }
          if (event.name === "down") {
            count.value -= 1;
            return true;
          }
          return false;
        });

        return () =>
          Paragraph({
            text: `Count: ${count.value}`,
            align: "left",
          });
      },
    });

    try {
      app.mount({ rows: 5, cols: 30 });
      const initialSnapshot = tty.output();
      expect(stripAnsi(initialSnapshot)).toMatch(/Count:\s*0/);
      let consumedLength = initialSnapshot.length;

      process.stdin.emit("data", "\x1b[A");
      let delta = tty.output().slice(consumedLength);
      expect(stripAnsi(delta)).toBe("1");
      consumedLength = tty.output().length;

      process.stdin.emit("data", "\x1b[B");
      delta = tty.output().slice(consumedLength);
      expect(stripAnsi(delta)).toBe("0");
    } finally {
      app.unmount();
      stdinGuard.restore();
      onceTracker.restore();
      tty.restore();
    }
  });
});
