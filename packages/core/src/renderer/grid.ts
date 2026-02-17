import { resolveColor } from "./colors";
import { FlatBuffer } from "./buffer";
import { type Buffer2D } from "./types/buffer";
import type { ColorValue } from "./types/color";
import { measureGraphemeWidth, segmentGraphemes } from "./grapheme";

/**
 * Internal helper to compute flat index into a Buffer2D (FlatBuffer).
 */
function indexOf(buf: Buffer2D, row: number, col: number): number {
  return row * buf.cols + col;
}

/**
 * Creates a new 2D buffer initialized with empty space characters.
 *
 * @param rows - Number of rows in the buffer
 * @param cols - Number of columns in the buffer
 * @returns A new Buffer2D instance
 *
 * @example
 * ```typescript
 * const buf = createBuffer(24, 80);
 * ```
 */
export function createBuffer(rows: number, cols: number): Buffer2D {
  const buf = new FlatBuffer(rows, cols);
  return buf;
}

/**
 * Creates a deep copy of a buffer.
 *
 * NOTE: In many cases、BufferPool と組み合わせて使う場合は clone が不要になるため、
 * 可能であれば利用箇所側での使用を見直してください。
 *
 * @param buf - The buffer to clone
 * @returns A new Buffer2D with copied glyphs and styles
 */
export function cloneBuffer(buf: Buffer2D): Buffer2D {
  const copy = new FlatBuffer(buf.rows, buf.cols);
  copy.codes.set(buf.codes);
  copy.extras.clear();
  for (const [idx, glyph] of buf.extras.entries()) {
    copy.extras.set(idx, glyph);
  }
  copy.widths.set(buf.widths);
  for (let i = 0; i < copy.fg.length; i++) {
    copy.fg[i] = buf.fg[i];
    copy.bg[i] = buf.bg[i];
  }
  copy.copyAsciiStateFrom(buf);
  return copy;
}

/**
 * Sets a single cell in the buffer at the specified position.
 * Out-of-bounds coordinates are safely ignored.
 *
 * @param buf - The buffer to modify
 * @param row - Row index (0-based)
 * @param col - Column index (0-based)
 * @param cell - Cell properties to set (character, foreground color, background color)
 *
 * @example
 * ```typescript
 * const buf = createBuffer(10, 10);
 * setCell(buf, 5, 5, { ch: "X", fg: "magenta" });
 * ```
 */
export function setCell(
  buf: Buffer2D,
  row: number,
  col: number,
  cell: { ch?: string; fg?: ColorValue; bg?: ColorValue },
) {
  if (row < 0 || row >= buf.rows) return;
  if (col < 0 || col >= buf.cols) return;

  const idx = indexOf(buf, row, col);

  if (cell.ch !== undefined) {
    buf.set(row, col, cell.ch);
  }

  if (cell.fg !== undefined) {
    const fgAnsi = resolveColor(cell.fg, "fg");
    buf.fg[idx] = fgAnsi;
  }

  if (cell.bg !== undefined) {
    const bgAnsi = resolveColor(cell.bg, "bg");
    buf.bg[idx] = bgAnsi;
  }
}

/**
 * Draws text into the buffer at the specified position.
 * Text is drawn horizontally from left to right.
 * Characters outside the buffer bounds are clipped.
 *
 * @param buf - The buffer to draw into
 * @param row - Starting row index (0-based)
 * @param col - Starting column index (0-based)
 * @param text - Text string to draw
 * @param style - Optional style with foreground and background colors
 *
 * @example
 * ```typescript
 * const buf = createBuffer(10, 40);
 * drawText(buf, 0, 0, "Hello, World!", { fg: "magenta" });
 * drawText(buf, 1, 5, "Colored text", { fg: "white", bg: "magenta" });
 * ```
 */
export function drawText(
  buf: Buffer2D,
  row: number,
  col: number,
  text: string,
  style?: { fg?: ColorValue; bg?: ColorValue },
) {
  row = Math.floor(row);
  col = Math.floor(col);

  if (row < 0 || row >= buf.rows) return;
  if (buf.cols === 0) return;

  const hasFg = style ? Object.prototype.hasOwnProperty.call(style, "fg") : false;
  const hasBg = style ? Object.prototype.hasOwnProperty.call(style, "bg") : false;

  const fg = style?.fg !== undefined ? resolveColor(style.fg, "fg") : undefined;
  const bg = style?.bg !== undefined ? resolveColor(style.bg, "bg") : undefined;
  const resolvedStyle = hasFg || hasBg ? { fg, bg } : undefined;

  // ASCII fast path:
  // - Avoid Intl.Segmenter
  // - Avoid per-grapheme width calculation
  // - Write directly as width=1 code points
  let isAscii = true;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 0x7f) {
      isAscii = false;
      break;
    }
  }
  if (isAscii) {
    let currentCol = col;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (currentCol >= buf.cols) break;
      if (currentCol + 1 <= 0) {
        currentCol += 1;
        continue;
      }
      if (currentCol < 0) {
        currentCol += 1;
        continue;
      }
      buf.setCodePoint(row, currentCol, code, resolvedStyle);
      currentCol += 1;
    }
    return;
  }

  const segments = segmentGraphemes(text);
  let currentCol = col;

  for (const segment of segments) {
    const width = Math.max(measureGraphemeWidth(segment), 1);
    if (currentCol >= buf.cols) break;
    if (currentCol + width <= 0) {
      currentCol += width;
      continue;
    }
    if (currentCol < 0) {
      currentCol += width;
      continue;
    }

    buf.set(row, currentCol, segment, resolvedStyle);
    currentCol += width;
  }
}

/**
 * Fills a rectangular area in the buffer with the specified character.
 * Useful for clearing regions, drawing backgrounds, or creating borders.
 *
 * @param buf - The buffer to draw into
 * @param row - Starting row index (0-based)
 * @param col - Starting column index (0-based)
 * @param width - Width of the rectangle in columns
 * @param height - Height of the rectangle in rows
 * @param char - Character to fill with (defaults to space)
 * @param style - Optional style with foreground and background colors
 *
 * @example
 * ```typescript
 * const buf = createBuffer(20, 40);
 * // Clear a 10x5 region
 * fillRect(buf, 5, 10, 10, 5, " ");
 * // Draw a filled box
 * fillRect(buf, 0, 0, 20, 3, "█", { fg: "magenta" });
 * ```
 */
export function fillRect(
  buf: Buffer2D,
  row: number,
  col: number,
  width: number,
  height: number,
  char = " ",
  style?: { fg?: ColorValue; bg?: ColorValue },
) {
  row = Math.floor(row);
  col = Math.floor(col);
  width = Math.floor(width);
  height = Math.floor(height);

  if (width <= 0 || height <= 0) return;

  const hasFg = style ? Object.prototype.hasOwnProperty.call(style, "fg") : false;
  const hasBg = style ? Object.prototype.hasOwnProperty.call(style, "bg") : false;

  const fg = style?.fg !== undefined ? resolveColor(style.fg, "fg") : undefined;
  const bg = style?.bg !== undefined ? resolveColor(style.bg, "bg") : undefined;
  const resolvedStyle = hasFg || hasBg ? { fg, bg } : undefined;

  let fillGlyph = " ";
  if (char.length === 1 && char.charCodeAt(0) <= 0x7f) {
    fillGlyph = char;
  } else {
    const cluster = segmentGraphemes(char)[0] ?? char;
    fillGlyph = measureGraphemeWidth(cluster) > 1 ? " " : cluster;
  }

  const maxRow = Math.min(buf.rows, row + height);
  const maxCol = Math.min(buf.cols, col + width);

  for (let r = Math.max(0, row); r < maxRow; r++) {
    for (let c = Math.max(0, col); c < maxCol; c++) {
      const idx = indexOf(buf, r, c);
      buf.set(r, c, fillGlyph, resolvedStyle);
      if (hasFg) buf.fg[idx] = fg;
      if (hasBg) buf.bg[idx] = bg;
    }
  }
}
