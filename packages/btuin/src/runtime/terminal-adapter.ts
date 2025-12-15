import type { KeyEvent } from "@btuin/terminal";
import * as terminal from "@btuin/terminal";

export interface TerminalAdapter {
  setupRawMode(): void;
  clearScreen(): void;
  cleanupWithoutClear(): void;
  patchConsole(): void;
  startCapture(): void;
  onKey(handler: (event: KeyEvent) => void): void;
  getTerminalSize(): { rows: number; cols: number };
  disposeSingletonCapture(): void;
  write(output: string): void;
}

export function createDefaultTerminalAdapter(): TerminalAdapter {
  return {
    setupRawMode: terminal.setupRawMode,
    clearScreen: terminal.clearScreen,
    cleanupWithoutClear: terminal.cleanupWithoutClear,
    patchConsole: terminal.patchConsole,
    startCapture: terminal.startCapture,
    onKey: terminal.onKey,
    getTerminalSize: terminal.getTerminalSize,
    disposeSingletonCapture: terminal.disposeSingletonCapture,
    write: terminal.write,
  };
}
