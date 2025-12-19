import type { KeyEvent } from "@/terminal";
import * as terminal from "@/terminal";
import type { InputParser } from "@/terminal/parser/types";

export interface TerminalAdapter {
  setupRawMode(): void;
  clearScreen(): void;
  moveCursor(row: number, col: number): void;
  cleanupWithoutClear(): void;
  patchConsole(): () => void;
  startCapture(): void;
  stopCapture(): void;
  onKey(handler: (event: KeyEvent) => void): void;
  getTerminalSize(): { rows: number; cols: number };
  disposeSingletonCapture(): void;
  write(output: string): void;
}

export interface CreateTerminalAdapterOptions {
  parser?: InputParser;
}

export function createDefaultTerminalAdapter(
  options: CreateTerminalAdapterOptions = {},
): TerminalAdapter {
  if (options.parser) {
    terminal.setInputParser(options.parser);
  }

  return {
    setupRawMode: terminal.setupRawMode,
    clearScreen: terminal.clearScreen,
    moveCursor: terminal.moveCursor,
    cleanupWithoutClear: terminal.cleanupWithoutClear,
    patchConsole: terminal.patchConsole,
    startCapture: terminal.startCapture,
    stopCapture: terminal.stopCapture,
    onKey: terminal.onKey,
    getTerminalSize: terminal.getTerminalSize,
    disposeSingletonCapture: terminal.disposeSingletonCapture,
    write: terminal.write,
  };
}
