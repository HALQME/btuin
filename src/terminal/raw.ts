import { AnsiInputParser } from "./parser/ansi";
import type { InputParser } from "./parser/types";
import type { KeyHandler } from "./types";

const ESCAPE_KEY_TIMEOUT_MS = 30;

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

let escapeFlushTimer: ReturnType<typeof setTimeout> | null = null;

function clearEscapeFlushTimer() {
  if (escapeFlushTimer) {
    clearTimeout(escapeFlushTimer);
    escapeFlushTimer = null;
  }
}

/**
 * Handles raw data from stdin and dispatches to registered handlers
 *
 * @param chunk - Raw input data as string
 */
function handleData(chunk: string) {
  clearEscapeFlushTimer();

  const parser = terminalState.getInputParser();
  const events = parser.parse(chunk);

  for (const event of events) {
    for (const handler of terminalState.getKeyHandlers()) {
      handler(event);
    }
  }

  if (!terminalState.isRawModeActive()) return;
  if (!parser.hasPendingEscape?.()) return;
  if (!parser.flush) return;

  const parserAtSchedule = parser;
  escapeFlushTimer = setTimeout(() => {
    escapeFlushTimer = null;
    if (!terminalState.isRawModeActive()) return;
    if (terminalState.getInputParser() !== parserAtSchedule) return;

    const flushed = parserAtSchedule.flush?.() ?? [];
    for (const event of flushed) {
      for (const handler of terminalState.getKeyHandlers()) {
        handler(event);
      }
    }
  }, ESCAPE_KEY_TIMEOUT_MS);
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
  clearEscapeFlushTimer();
  if (!terminalState.isRawModeActive()) {
    return;
  }

  terminalState.setRawModeActive(false);

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
  clearEscapeFlushTimer();
  if (!terminalState.isRawModeActive()) {
    return;
  }

  terminalState.setRawModeActive(false);

  if (process.stdin.listenerCount("data") > 0) {
    process.stdin.off("data", handleData);
  }

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }

  process.stdin.pause();
}
