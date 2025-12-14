import type { KeyEvent, KeyHandler } from "./types";
import { clearScreen, hideCursor, showCursor } from "./io";

/**
 * Terminal raw mode state - encapsulated in a singleton
 */
class TerminalState {
  private keyHandlers: KeyHandler[] = [];
  private rawModeActive = false;

  addKeyHandler(handler: KeyHandler): void {
    this.keyHandlers.push(handler);
  }

  getKeyHandlers(): KeyHandler[] {
    return this.keyHandlers;
  }

  isRawModeActive(): boolean {
    return this.rawModeActive;
  }

  setRawModeActive(active: boolean): void {
    this.rawModeActive = active;
  }
}

const terminalState = new TerminalState();

/**
 * ANSI Escape Sequence Map
 * Maps terminal escape sequences to normalized key events
 * Organized by category for maintainability
 */
const ESCAPE_SEQUENCES: Record<string, Omit<KeyEvent, "sequence">> = {
  // Arrow keys
  "\x1b[A": { name: "up", ctrl: false, meta: false, shift: false },
  "\x1b[B": { name: "down", ctrl: false, meta: false, shift: false },
  "\x1b[C": { name: "right", ctrl: false, meta: false, shift: false },
  "\x1b[D": { name: "left", ctrl: false, meta: false, shift: false },

  // Navigation keys
  "\x1b[H": { name: "home", ctrl: false, meta: false, shift: false },
  "\x1b[F": { name: "end", ctrl: false, meta: false, shift: false },
  "\x1b[1~": { name: "home", ctrl: false, meta: false, shift: false },
  "\x1b[4~": { name: "end", ctrl: false, meta: false, shift: false },
  "\x1b[5~": { name: "pageup", ctrl: false, meta: false, shift: false },
  "\x1b[6~": { name: "pagedown", ctrl: false, meta: false, shift: false },
  "\x1b[2~": { name: "insert", ctrl: false, meta: false, shift: false },
  "\x1b[3~": { name: "delete", ctrl: false, meta: false, shift: false },

  // Shift + Tab
  "\x1b[Z": { name: "tab", ctrl: false, meta: false, shift: true },

  // Function keys (F1-F12)
  "\x1bOP": { name: "f1", ctrl: false, meta: false, shift: false },
  "\x1bOQ": { name: "f2", ctrl: false, meta: false, shift: false },
  "\x1bOR": { name: "f3", ctrl: false, meta: false, shift: false },
  "\x1bOS": { name: "f4", ctrl: false, meta: false, shift: false },
  "\x1b[15~": { name: "f5", ctrl: false, meta: false, shift: false },
  "\x1b[17~": { name: "f6", ctrl: false, meta: false, shift: false },
  "\x1b[18~": { name: "f7", ctrl: false, meta: false, shift: false },
  "\x1b[19~": { name: "f8", ctrl: false, meta: false, shift: false },
  "\x1b[20~": { name: "f9", ctrl: false, meta: false, shift: false },
  "\x1b[21~": { name: "f10", ctrl: false, meta: false, shift: false },
  "\x1b[23~": { name: "f11", ctrl: false, meta: false, shift: false },
  "\x1b[24~": { name: "f12", ctrl: false, meta: false, shift: false },

  // Ctrl + Arrow keys
  "\x1b[1;5A": { name: "up", ctrl: true, meta: false, shift: false },
  "\x1b[1;5B": { name: "down", ctrl: true, meta: false, shift: false },
  "\x1b[1;5C": { name: "right", ctrl: true, meta: false, shift: false },
  "\x1b[1;5D": { name: "left", ctrl: true, meta: false, shift: false },

  // Shift + Arrow keys
  "\x1b[1;2A": { name: "up", ctrl: false, meta: false, shift: true },
  "\x1b[1;2B": { name: "down", ctrl: false, meta: false, shift: true },
  "\x1b[1;2C": { name: "right", ctrl: false, meta: false, shift: true },
  "\x1b[1;2D": { name: "left", ctrl: false, meta: false, shift: true },

  // Alt/Meta + Arrow keys
  "\x1b[1;3A": { name: "up", ctrl: false, meta: true, shift: false },
  "\x1b[1;3B": { name: "down", ctrl: false, meta: true, shift: false },
  "\x1b[1;3C": { name: "right", ctrl: false, meta: true, shift: false },
  "\x1b[1;3D": { name: "left", ctrl: false, meta: true, shift: false },
};

/**
 * Control character codes (0x00-0x1F)
 * Used for Ctrl+key combinations
 */
const CTRL_KEY_MAP: Record<number, string> = {
  0x01: "a", // Ctrl+A
  0x02: "b", // Ctrl+B
  0x03: "c", // Ctrl+C
  0x04: "d", // Ctrl+D
  0x05: "e", // Ctrl+E
  0x06: "f", // Ctrl+F
  0x07: "g", // Ctrl+G
  0x08: "h", // Ctrl+H (also Backspace on some terminals)
  0x09: "i", // Ctrl+I (also Tab)
  0x0a: "j", // Ctrl+J (also Line Feed)
  0x0b: "k", // Ctrl+K
  0x0c: "l", // Ctrl+L
  0x0d: "m", // Ctrl+M (also Carriage Return)
  0x0e: "n", // Ctrl+N
  0x0f: "o", // Ctrl+O
  0x10: "p", // Ctrl+P
  0x11: "q", // Ctrl+Q
  0x12: "r", // Ctrl+R
  0x13: "s", // Ctrl+S
  0x14: "t", // Ctrl+T
  0x15: "u", // Ctrl+U
  0x16: "v", // Ctrl+V
  0x17: "w", // Ctrl+W
  0x18: "x", // Ctrl+X
  0x19: "y", // Ctrl+Y
  0x1a: "z", // Ctrl+Z
};

/**
 * Special single-byte character map
 * Maps common special characters to their key names
 */
const SPECIAL_CHARS: Record<string, string> = {
  " ": "space",
  "\r": "enter",
  "\n": "return",
  "\t": "tab",
  "\x7f": "backspace",
  "\x1b": "escape",
};

/**
 * Normalizes raw keyboard input into a consistent KeyEvent structure
 *
 * Processing order:
 * 1. Check ANSI escape sequences (highest priority)
 * 2. Handle special single-byte characters (space, enter, tab, etc.)
 * 3. Process control characters (Ctrl+key)
 * 4. Handle meta/alt combinations (ESC prefix)
 * 5. Process regular printable characters
 *
 * @param chunk - Raw input string from stdin
 * @returns Normalized KeyEvent
 */
function normalizeKey(chunk: string): KeyEvent {
  // Fast path: Check escape sequence map first (O(1) lookup)
  if (ESCAPE_SEQUENCES[chunk]) {
    return {
      sequence: chunk,
      ...ESCAPE_SEQUENCES[chunk],
    };
  }

  // Extract meta/alt modifier (ESC prefix)
  let sequence = chunk;
  let meta = false;

  if (chunk.length > 1 && chunk.startsWith("\x1b") && !chunk.startsWith("\x1b[")) {
    meta = true;
    sequence = chunk.slice(1);
  }

  const code = sequence.charCodeAt(0);
  let name = sequence;
  let ctrl = false;
  let shift = false;

  // Fast path: Check special single-byte characters (O(1) lookup)
  if (SPECIAL_CHARS[sequence]) {
    name = SPECIAL_CHARS[sequence]!;
  } else if (code >= 0x01 && code <= 0x1a) {
    // Control characters (Ctrl+A through Ctrl+Z)
    ctrl = true;
    name = CTRL_KEY_MAP[code] || String.fromCharCode(code + 96);
  } else if (code === 0x00) {
    // Ctrl+Space (NUL)
    ctrl = true;
    name = "space";
  } else if (code >= 0x20 && code <= 0x7e) {
    // Printable ASCII characters
    const char = sequence;
    name = char;
    // Detect shift for letters and symbols
    if (char.length === 1) {
      const isUpperLetter = char >= "A" && char <= "Z";
      const isLowerLetter = char >= "a" && char <= "z";
      const isShiftedSymbol = '!@#$%^&*()_+{}|:"<>?'.includes(char) || (char >= "A" && char <= "Z");

      if (isUpperLetter || (isShiftedSymbol && !isLowerLetter)) {
        shift = true;
      }
    }
  }

  return {
    sequence: chunk,
    name,
    ctrl,
    meta,
    shift,
  };
}

/**
 * Handles raw data from stdin and dispatches to registered handlers
 *
 * @param chunk - Raw input data as string
 */
function handleData(chunk: string) {
  const event = normalizeKey(chunk);

  // Dispatch to all registered handlers
  for (const handler of terminalState.getKeyHandlers()) {
    handler(event);
  }

  // Handle Ctrl+C for graceful exit
  if (event.sequence === "\x03" || (event.ctrl && event.name === "c")) {
    cleanup();
    process.exit(0);
  }
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
  process.once("exit", cleanup);

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
