import { getUiOutputStream } from "./tty-streams";

/**
 * Gets the current terminal size.
 * Returns default values (80x24) if terminal size cannot be determined.
 *
 * @returns Object with cols and rows properties
 */
export function getTerminalSize(): { cols: number; rows: number } {
  const stream = getUiOutputStream();
  const cols = stream.columns || 80;
  const rows = stream.rows || 24;
  return { cols, rows };
}

export function clearScreen() {
  const out = getUiOutputStream();
  out.write("\x1b[2J");
  out.write("\x1b[H");
}

export function moveCursor(row: number, col: number) {
  getUiOutputStream().write(`\x1b[${row};${col}H`);
}

export function write(str: string) {
  getUiOutputStream().write(str);
}

export function hideCursor() {
  getUiOutputStream().write("\x1b[?25l");
}

export function showCursor() {
  getUiOutputStream().write("\x1b[?25h");
}

export function enableBracketedPaste() {
  getUiOutputStream().write("\x1b[?2004h");
}

export function disableBracketedPaste() {
  getUiOutputStream().write("\x1b[?2004l");
}
