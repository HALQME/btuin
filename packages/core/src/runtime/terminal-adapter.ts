import type { KeyEvent } from "../terminal/types/key-event";
import * as terminal from "../terminal";
import type { InputParser } from "../terminal/parser/types";
import { bypassStderrWrite, bypassStdoutWrite, onStderr, onStdout } from "../terminal/capture";

export interface TerminalAdapter {
  setupRawMode(): void;
  clearScreen(): void;
  moveCursor(row: number, col: number): void;
  cleanupWithoutClear(): void;
  setBracketedPaste?(enabled: boolean): void;
  patchConsole(): () => void;
  startCapture(): void;
  stopCapture(): void;
  /**
   * Subscribe to captured stdout writes (when `startCapture()` is active).
   * Used by inline mode to temporarily clear the UI, print output, then re-render.
   */
  onStdout?(handler: (text: string) => void): () => void;
  /**
   * Subscribe to captured stderr writes (when `startCapture()` is active).
   * Used by inline mode to temporarily clear the UI, print output, then re-render.
   */
  onStderr?(handler: (text: string) => void): () => void;
  /**
   * Write to the real stdout even when capture is enabled.
   */
  writeStdout?(text: string): void;
  /**
   * Write to the real stderr even when capture is enabled.
   */
  writeStderr?(text: string): void;
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
    setBracketedPaste: (enabled) =>
      enabled ? terminal.enableBracketedPaste() : terminal.disableBracketedPaste(),
    patchConsole: terminal.patchConsole,
    startCapture: terminal.startCapture,
    stopCapture: terminal.stopCapture,
    onStdout,
    onStderr,
    writeStdout: (text) => {
      bypassStdoutWrite(text);
    },
    writeStderr: (text) => {
      bypassStderrWrite(text);
    },
    onKey: terminal.onKey,
    getTerminalSize: terminal.getTerminalSize,
    disposeSingletonCapture: terminal.disposeSingletonCapture,
    write: terminal.write,
  };
}
