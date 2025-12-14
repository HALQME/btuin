/**
 * Flat buffer for terminal rendering.
 *
 * Internally stores characters in a flat Uint32Array and color attributes
 * in parallel string arrays:
 * - cells: UTF-32 code point for each cell (space by default)
 * - fg: foreground color (ANSI escape sequence or theme color name)
 * - bg: background color (ANSI escape sequence or theme color name)
 *
 * Index calculation:
 *   index = row * cols + col
 */
export class FlatBuffer {
  readonly rows: number;
  readonly cols: number;
  readonly cells: Uint32Array;
  readonly fg: (string | undefined)[];
  readonly bg: (string | undefined)[];

  constructor(rows: number, cols: number) {
    this.rows = rows;
    this.cols = cols;
    const size = rows * cols;
    this.cells = new Uint32Array(size);
    this.fg = Array.from({ length: size });
    this.bg = Array.from({ length: size });
    this.clear();
  }

  /**
   * Reset all cells to space and clear color attributes.
   */
  clear(): void {
    this.cells.fill(32); // ASCII space
    this.fg.fill(undefined);
    this.bg.fill(undefined);
  }

  /**
   * Compute flat index from row/col.
   */
  index(row: number, col: number): number {
    return row * this.cols + col;
  }

  /**
   * Get a cell's character and styling at the given position.
   * Out-of-bounds reads return a space with no style.
   */
  get(row: number, col: number): { char: string; style: { fg?: string; bg?: string } } {
    if (row < 0 || row >= this.rows) return { char: " ", style: {} };
    if (col < 0 || col >= this.cols) return { char: " ", style: {} };
    const idx = this.index(row, col);
    return {
      char: String.fromCodePoint(this.cells[idx] ?? 32),
      style: { fg: this.fg[idx], bg: this.bg[idx] },
    };
  }

  /**
   * Set a cell's character and (optionally) styling at the given position.
   * Out-of-bounds writes are safely ignored.
   */
  set(row: number, col: number, ch: string, style?: { fg?: string; bg?: string }): void {
    if (row < 0 || row >= this.rows) return;
    if (col < 0 || col >= this.cols) return;
    const idx = this.index(row, col);
    this.cells[idx] = ch.codePointAt(0) ?? 32;
    if (style?.fg !== undefined) this.fg[idx] = style.fg;
    if (style?.bg !== undefined) this.bg[idx] = style.bg;
  }
}
