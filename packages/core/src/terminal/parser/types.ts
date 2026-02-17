import type { KeyEvent } from "../types/key-event";

/**
 * Interface for parsing raw stdin data into KeyEvents.
 */
export interface InputParser {
  /**
   * Parses a raw string or buffer chunk from stdin into an array of KeyEvents.
   * A single chunk can result in multiple events (e.g., pasting).
   *
   * @param chunk - The raw data chunk from stdin.
   * @returns An array of normalized KeyEvent objects.
   */
  parse(chunk: string): KeyEvent[];

  /**
   * True if the parser is holding a standalone ESC byte that needs a timeout
   * before it can be safely emitted as "escape" (to disambiguate Alt/Meta and
   * chunked CSI sequences).
   */
  hasPendingEscape?(): boolean;

  /**
   * Flushes any pending events that require an external timeout to resolve.
   * Typically used for emitting a standalone "escape" key press.
   */
  flush?(): KeyEvent[];
}
