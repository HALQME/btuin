import fs from "node:fs";
import tty from "node:tty";
import { bypassStderrWrite, bypassStdoutWrite } from "./capture";

type UiOutput = NodeJS.WriteStream & { isTTY?: boolean; columns?: number; rows?: number };
type UiInput = NodeJS.ReadStream & { isTTY?: boolean; setRawMode?: (enabled: boolean) => void };

let cachedDevTty: {
  input: UiInput;
  output: UiOutput;
} | null = null;

let cachedUiOutput: UiOutput | null = null;
let cachedUiInput: UiInput | null = null;

function createWriteBypassProxy<T extends NodeJS.WriteStream>(
  target: T,
  writeFn: typeof bypassStdoutWrite,
): UiOutput {
  const proxy = Object.create(target) as UiOutput;
  proxy.write = function (chunk: any, encoding?: any, callback?: any) {
    return writeFn(chunk, encoding, callback);
  } as any;
  return proxy;
}

function ensureDevTty(): { input: UiInput; output: UiOutput } | null {
  if (cachedDevTty) return cachedDevTty;

  if (process.platform === "win32") return null;

  try {
    const inputFd = fs.openSync("/dev/tty", "r");
    const outputFd = fs.openSync("/dev/tty", "w");
    const input = new tty.ReadStream(inputFd) as UiInput;
    const output = new tty.WriteStream(outputFd) as UiOutput;

    process.once("exit", () => {
      try {
        input.destroy();
      } catch {}
      try {
        output.destroy();
      } catch {}
    });

    cachedDevTty = { input, output };
    return cachedDevTty;
  } catch {
    return null;
  }
}

export function getUiOutputStream(): UiOutput {
  if (cachedUiOutput) return cachedUiOutput;

  if (process.stdout.isTTY) {
    cachedUiOutput = createWriteBypassProxy(process.stdout, bypassStdoutWrite);
    return cachedUiOutput;
  }
  if (process.stderr.isTTY) {
    cachedUiOutput = createWriteBypassProxy(process.stderr, bypassStderrWrite);
    return cachedUiOutput;
  }

  const devTty = ensureDevTty();
  if (devTty) {
    cachedUiOutput = devTty.output;
    return cachedUiOutput;
  }

  cachedUiOutput = createWriteBypassProxy(process.stdout, bypassStdoutWrite);
  return cachedUiOutput;
}

export function getUiInputStream(): UiInput {
  if (cachedUiInput) return cachedUiInput;
  if (process.stdin.isTTY) {
    cachedUiInput = process.stdin as UiInput;
    return cachedUiInput;
  }

  const devTty = ensureDevTty();
  if (devTty) {
    cachedUiInput = devTty.input;
    return cachedUiInput;
  }

  cachedUiInput = process.stdin as UiInput;
  return cachedUiInput;
}
