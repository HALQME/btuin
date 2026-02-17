import type { KeyEvent } from "../types";
import type { InputParser } from "./types";

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
 */
const CTRL_KEY_MAP: Record<number, string> = {
  0x01: "a",
  0x02: "b",
  0x03: "c",
  0x04: "d",
  0x05: "e",
  0x06: "f",
  0x07: "g",
  0x08: "h",
  0x09: "i",
  0x0a: "j",
  0x0b: "k",
  0x0c: "l",
  0x0d: "m",
  0x0e: "n",
  0x0f: "o",
  0x10: "p",
  0x11: "q",
  0x12: "r",
  0x13: "s",
  0x14: "t",
  0x15: "u",
  0x16: "v",
  0x17: "w",
  0x18: "x",
  0x19: "y",
  0x1a: "z",
};

/**
 * Special single-byte character map
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
 * A stateful parser for ANSI keyboard input sequences.
 * It handles chunked data by buffering incomplete escape sequences.
 */
export class AnsiInputParser implements InputParser {
  private buffer: string = "";
  private isPasting: boolean = false;
  private pasteBuffer: string = "";

  // A sorted list of escape sequences, longest first, to ensure correct matching.
  private readonly sortedEscapeSequences: string[] = Object.keys(ESCAPE_SEQUENCES).sort(
    (a, b) => b.length - a.length,
  );

  parse(chunk: string): KeyEvent[] {
    this.buffer += chunk;
    const events: KeyEvent[] = [];

    while (this.buffer.length > 0) {
      // Priority 1: Handle pasting state
      if (this.isPasting) {
        const endSequence = "\x1b[201~";
        const endMatch = this.buffer.indexOf(endSequence);

        if (endMatch !== -1) {
          // End of paste found
          this.pasteBuffer += this.buffer.slice(0, endMatch);
          if (this.pasteBuffer.length > 0) {
            events.push({
              name: "paste",
              sequence: this.pasteBuffer,
              data: this.pasteBuffer,
              ctrl: false,
              meta: false,
              shift: false,
            });
          }
          this.isPasting = false;
          this.pasteBuffer = "";
          this.buffer = this.buffer.slice(endMatch + endSequence.length);
        } else {
          // Still pasting, add entire buffer to paste buffer and wait for more
          this.pasteBuffer += this.buffer;
          this.buffer = "";
        }
        continue;
      }

      // Priority 2: Check for start of paste
      const startSequence = "\x1b[200~";
      if (this.buffer.startsWith(startSequence)) {
        this.isPasting = true;
        this.buffer = this.buffer.slice(startSequence.length);
        continue;
      }

      // Priority 4: Find a matching escape sequence
      let matchedKey: Omit<KeyEvent, "sequence"> | undefined;
      let matchedSequence: string | undefined;
      for (const seq of this.sortedEscapeSequences) {
        if (this.buffer.startsWith(seq)) {
          matchedSequence = seq;
          matchedKey = ESCAPE_SEQUENCES[seq];
          break;
        }
      }

      if (matchedSequence && matchedKey) {
        events.push({
          sequence: matchedSequence,
          name: matchedKey.name,
          ctrl: matchedKey.ctrl,
          meta: matchedKey.meta,
          shift: matchedKey.shift,
        });
        this.buffer = this.buffer.slice(matchedSequence.length);
        continue;
      }

      // Priority 5: Check for a partial escape sequence match
      const isPartial = this.sortedEscapeSequences.some(
        (seq) => seq.startsWith(this.buffer) && seq !== this.buffer,
      );

      if (isPartial) {
        break; // Wait for more data
      }

      // Priority 6: Process as a single character
      const firstChar = this.buffer[0];
      if (firstChar === undefined) break; // Should be unreachable

      let name: string;
      let ctrl = false;
      let meta = false;
      let shift = false;
      let consumedLength = 1;
      let char = firstChar;

      // Handle Alt/Meta key (ESC + char)
      if (char === "\x1b" && this.buffer.length > 1) {
        const nextChar = this.buffer[1];
        if (nextChar && nextChar !== "[" && nextChar !== "O") {
          meta = true;
          char = nextChar;
          consumedLength = 2;
        }
      }

      const code = char.charCodeAt(0);
      const specialName = SPECIAL_CHARS[char];

      if (specialName) {
        name = specialName;
      } else if (meta === false && code >= 0x01 && code <= 0x1a) {
        ctrl = true;
        name = CTRL_KEY_MAP[code] ?? String.fromCharCode(code + 96);
      } else if (meta === false && code === 0x00) {
        ctrl = true;
        name = "space";
      } else {
        // Printable characters
        const isUpperLetter = char >= "A" && char <= "Z";
        const isLowerLetter = char >= "a" && char <= "z";
        const isShiftedSymbol = !meta && `!@#$%^&*()_+{}|:"<>?`.includes(char);

        if (!meta && (isUpperLetter || (isShiftedSymbol && !isLowerLetter))) {
          shift = true;
        }
        name = char;
      }

      const originalSequence = this.buffer.slice(0, consumedLength);
      events.push({ sequence: originalSequence, name, ctrl, meta, shift });
      this.buffer = this.buffer.slice(consumedLength);
    }

    return events;
  }

  hasPendingEscape(): boolean {
    return this.isPasting === false && this.buffer === "\x1b";
  }

  flush(): KeyEvent[] {
    if (!this.hasPendingEscape()) return [];
    this.buffer = "";
    return [{ sequence: "\x1b", name: "escape", ctrl: false, meta: false, shift: false }];
  }
}
