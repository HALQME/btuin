import type { KeyEvent } from "@/terminal";
import * as terminal from "@/terminal";

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

export function createDefaultTerminalAdapter(): TerminalAdapter {
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
