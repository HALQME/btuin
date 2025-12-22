import fs from "node:fs";
import tty from "node:tty";
import { getOriginalStderr, getOriginalStdout } from "./capture";

type UiOutput = NodeJS.WriteStream & { isTTY?: boolean; columns?: number; rows?: number };
type UiInput = NodeJS.ReadStream & { isTTY?: boolean; setRawMode?: (enabled: boolean) => void };

let cachedDevTty: {
  input: UiInput;
  output: UiOutput;
} | null = null;

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
  if (process.stdout.isTTY) return getOriginalStdout() as UiOutput;
  if (process.stderr.isTTY) return getOriginalStderr() as UiOutput;

  const devTty = ensureDevTty();
  if (devTty) return devTty.output;

  return getOriginalStdout() as UiOutput;
}

export function getUiInputStream(): UiInput {
  if (process.stdin.isTTY) return process.stdin as UiInput;

  const devTty = ensureDevTty();
  if (devTty) return devTty.input;

  return process.stdin as UiInput;
}
