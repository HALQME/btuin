import type { KeyEvent } from "../types/key-event";

/**
 * Interface for parsing raw stdin data into KeyEvents.
 */
export interface InputParser {
  /**
   * Parses a raw string or buffer chunk from stdin into a KeyEvent.
   *
   * @param chunk - The raw data chunk from stdin.
   * @returns A normalized KeyEvent object.
   */
  parse(chunk: string): KeyEvent;
}
