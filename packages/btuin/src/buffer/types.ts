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
}

/**
 * Public buffer type used throughout the renderer.
 */
export type Buffer2D = FlatBuffer;
