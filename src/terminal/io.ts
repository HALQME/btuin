import { getOriginalStdout } from "./capture";

/**
 * Gets the current terminal size.
 * Returns default values (80x24) if terminal size cannot be determined.
 *
 * @returns Object with cols and rows properties
 */
export function getTerminalSize(): { cols: number; rows: number } {
  const cols = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;
  return { cols, rows };
}

export function clearScreen() {
  getOriginalStdout().write("\x1b[2J");
  getOriginalStdout().write("\x1b[H");
}

export function moveCursor(row: number, col: number) {
  getOriginalStdout().write(`\x1b[${row};${col}H`);
}

export function write(str: string) {
  getOriginalStdout().write(str);
}

export function hideCursor() {
  getOriginalStdout().write("\x1b[?25l");
}

export function showCursor() {
  getOriginalStdout().write("\x1b[?25h");
}

export function enableBracketedPaste() {
  getOriginalStdout().write("\x1b[?2004h");
}

export function disableBracketedPaste() {
  getOriginalStdout().write("\x1b[?2004l");
}
