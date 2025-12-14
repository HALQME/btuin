import { measureGraphemeWidth, segmentGraphemes } from "./grapheme";

/**
 * Flat buffer for terminal rendering.
 *
 * Each cell stores:
 * - codes: the Unicode code point for single-code-point glyphs (0 on continuation slots)
 * - extras: Map for grapheme clusters (multi-code-point glyphs) keyed by cell index
 * - widths: the column width (0 indicates a continuation cell)
 * - fg/bg: color styles matching current cells
 *
 * Index calculation:
 *   index = row * cols + col
 */
export class FlatBuffer {
  readonly rows: number;
  readonly cols: number;
  readonly codes: Uint32Array;
  readonly extras: Map<number, string>;
  readonly widths: Uint8Array;
  readonly fg: (string | undefined)[];
  readonly bg: (string | undefined)[];

  constructor(rows: number, cols: number) {
    this.rows = rows;
    this.cols = cols;
    const size = rows * cols;
    this.codes = new Uint32Array(size);
    this.extras = new Map();
    this.widths = new Uint8Array(size);
    this.fg = Array.from({ length: size });
    this.bg = Array.from({ length: size });
    this.clear();
  }

  /**
   * Reset all cells to space and clear color attributes.
   */
  clear(): void {
    this.codes.fill(32); // space
    this.extras.clear();
    this.widths.fill(1);
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
    const width = this.widths[idx] ?? 1;
    return {
      char: width === 0 ? "" : this.glyphStringAtIndex(idx),
      style: { fg: this.fg[idx], bg: this.bg[idx] },
    };
  }

  glyphStringAtIndex(idx: number): string {
    const width = this.widths[idx] ?? 1;
    if (width === 0) return "";
    const extra = this.extras.get(idx);
    if (extra !== undefined) return extra;
    const code = this.codes[idx] ?? 32;
    if (code === 0) return " ";
    return String.fromCodePoint(code);
  }

  glyphKeyAtIndex(idx: number): string | number {
    const extra = this.extras.get(idx);
    if (extra !== undefined) return extra;
    return this.codes[idx] ?? 32;
  }

  /**
   * Set a cell's character and (optionally) styling at the given position.
   * Out-of-bounds writes are safely ignored.
   */
  set(row: number, col: number, ch: string, style?: { fg?: string; bg?: string }): void {
    if (row < 0 || row >= this.rows) return;
    if (col < 0 || col >= this.cols) return;

    if (ch.length === 1) {
      const code = ch.charCodeAt(0);
      if (code <= 0x7f) {
        this.writeGlyph(row, col, ch, 1, style);
        return;
      }
    }

    const graphemes = segmentGraphemes(ch);
    const glyph = graphemes[0] ?? ch;
    const width = Math.max(measureGraphemeWidth(glyph), 1);
    this.writeGlyph(row, col, glyph, width, style);
  }

  setCodePoint(
    row: number,
    col: number,
    codePoint: number,
    style?: { fg?: string; bg?: string },
  ): void {
    if (row < 0 || row >= this.rows) return;
    if (col < 0 || col >= this.cols) return;
    const ch = String.fromCodePoint(codePoint);
    this.writeGlyph(row, col, ch, 1, style);
  }

  private writeGlyph(
    row: number,
    col: number,
    glyph: string,
    width: number,
    style?: { fg?: string; bg?: string },
  ) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    if (col + width > this.cols) return;

    const idx = this.index(row, col);
    if (this.widths[idx] === 0) {
      this.clearWideSpan(row, col);
    }
    this.clearFollowingContinuations(row, col);
    const normalized = glyph || " ";
    if ([...normalized].length > 1) {
      this.extras.set(idx, normalized);
      const first = normalized.codePointAt(0) ?? 32;
      this.codes[idx] = first;
    } else {
      this.extras.delete(idx);
      this.codes[idx] = normalized.codePointAt(0) ?? 32;
    }
    this.widths[idx] = width;
    if (style?.fg !== undefined) this.fg[idx] = style.fg;
    if (style?.bg !== undefined) this.bg[idx] = style.bg;

    for (let offset = 1; offset < width; offset++) {
      const contCol = col + offset;
      if (contCol >= this.cols) break;
      const contIdx = this.index(row, contCol);
      this.extras.delete(contIdx);
      this.codes[contIdx] = 0;
      this.widths[contIdx] = 0;
      if (style?.fg !== undefined) this.fg[contIdx] = style.fg;
      if (style?.bg !== undefined) this.bg[contIdx] = style.bg;
    }
  }

  private clearWideSpan(row: number, col: number) {
    let baseCol = col - 1;
    let baseIdx = -1;
    while (baseCol >= 0) {
      const idx = this.index(row, baseCol);
      if (this.widths[idx] === 0) {
        baseCol--;
        continue;
      }
      baseIdx = idx;
      break;
    }
    if (baseIdx === -1) return;
    const spanWidth = this.widths[baseIdx];
    if (spanWidth === undefined || spanWidth <= 1) return;
    const rowStart = baseCol;
    for (let offset = 0; offset < spanWidth; offset++) {
      const targetIdx = this.index(row, rowStart + offset);
      this.extras.delete(targetIdx);
      this.codes[targetIdx] = 32;
      this.widths[targetIdx] = 1;
      this.fg[targetIdx] = undefined;
      this.bg[targetIdx] = undefined;
    }
  }

  private clearFollowingContinuations(row: number, col: number) {
    let nextCol = col + 1;
    while (nextCol < this.cols) {
      const nextIdx = this.index(row, nextCol);
      if (this.widths[nextIdx] !== 0) break;
      this.extras.delete(nextIdx);
      this.codes[nextIdx] = 32;
      this.widths[nextIdx] = 1;
      this.fg[nextIdx] = undefined;
      this.bg[nextIdx] = undefined;
      nextCol++;
    }
  }
}
