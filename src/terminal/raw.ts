import type { KeyHandler } from "./types";
import { clearScreen, hideCursor, showCursor } from "./io";
import { AnsiInputParser } from "./parser/ansi";
import type { InputParser } from "./parser/types";

/**
 * Terminal raw mode state - encapsulated in a singleton
 */
class TerminalState {
  private keyHandlers: KeyHandler[] = [];
  private rawModeActive = false;
  private inputParser: InputParser = new AnsiInputParser();

  addKeyHandler(handler: KeyHandler): void {
    this.keyHandlers.push(handler);
  }

  getKeyHandlers(): KeyHandler[] {
    return this.keyHandlers;
  }

  clearKeyHandlers(): void {
    this.keyHandlers.length = 0;
  }

  isRawModeActive(): boolean {
    return this.rawModeActive;
  }

  setRawModeActive(active: boolean): void {
    this.rawModeActive = active;
  }

  getInputParser(): InputParser {
    return this.inputParser;
  }

  setInputParser(parser: InputParser): void {
    this.inputParser = parser;
  }
}

const terminalState = new TerminalState();

/**
 * Handles raw data from stdin and dispatches to registered handlers
 *
 * @param chunk - Raw input data as string
 */
function handleData(chunk: string) {
  const parser = terminalState.getInputParser();
  const event = parser.parse(chunk);

  for (const handler of terminalState.getKeyHandlers()) {
    handler(event);
  }
}

/**
 * Allows swapping the global input parser strategy.
 * This should be called before `setupRawMode`.
 * @param parser - An instance of an InputParser.
 */
export function setInputParser(parser: InputParser) {
  terminalState.setInputParser(parser);
}

/**
 * Enables raw mode for the terminal
 *
 * Raw mode characteristics:
 * - Disables line buffering (immediate input)
 * - Disables echo (no automatic character display)
 * - Disables canonical mode (process each character)
 * - Captures special keys (Ctrl+C, Ctrl+Z, etc.)
 */
export function setupRawMode() {
  if (terminalState.isRawModeActive()) return;
  if (!process.stdin.isTTY) return;

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", handleData);
  process.once("exit", cleanupWithoutClear);

  hideCursor();
  terminalState.setRawModeActive(true);
}

/**
 * Registers a key event handler
 *
 * @param handler - Function to call when key events occur
 */
export function onKey(handler: KeyHandler) {
  terminalState.addKeyHandler(handler);
}

export function resetKeyHandlers() {
  terminalState.clearKeyHandlers();
}

/**
 * Cleans up terminal state and restores normal mode without clearing the screen
 *
 * Should be called before program exit when you want to preserve screen content
 */
export function cleanupWithoutClear() {
  if (!terminalState.isRawModeActive()) {
    showCursor();
    return;
  }

  terminalState.setRawModeActive(false);
  showCursor();

  if (process.stdin.listenerCount("data") > 0) {
    process.stdin.off("data", handleData);
  }

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }

  process.stdin.pause();
}

/**
 * Cleans up terminal state and restores normal mode
 *
 * Should be called before program exit to ensure terminal
 * is left in a usable state
 */
export function cleanup() {
  if (!terminalState.isRawModeActive()) {
    showCursor();
    return;
  }

  terminalState.setRawModeActive(false);
  clearScreen();
  showCursor();

  if (process.stdin.listenerCount("data") > 0) {
    process.stdin.off("data", handleData);
  }

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }

  process.stdin.pause();
}
