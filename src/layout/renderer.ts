import type { ComputedLayout } from "../layout-engine/types";
import { measureGraphemeWidth, resolveColor, segmentGraphemes } from "../renderer";
import type { Buffer2D } from "../renderer/types";
import type { ColorValue } from "../renderer/types/color";
import { isBlock, isText, type ViewElement } from "../view/types/elements";

type Rect = { x: number; y: number; width: number; height: number };

function intersectRect(a: Rect, b: Rect): Rect | null {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const width = x2 - x1;
  const height = y2 - y1;
  if (width <= 0 || height <= 0) return null;
  return { x: x1, y: y1, width, height };
}

function resolvePadding(padding: unknown): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  if (typeof padding === "number") {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  if (Array.isArray(padding) && padding.length === 4) {
    const [top, right, bottom, left] = padding as number[];
    return {
      top: typeof top === "number" ? top : 0,
      right: typeof right === "number" ? right : 0,
      bottom: typeof bottom === "number" ? bottom : 0,
      left: typeof left === "number" ? left : 0,
    };
  }
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

function fillRectClipped(
  buffer: Buffer2D,
  rect: Rect,
  char: string,
  style: { fg?: ColorValue; bg?: ColorValue } | undefined,
  clip: Rect,
) {
  const intersection = intersectRect(rect, clip);
  if (!intersection) return;

  const hasFg = style ? Object.prototype.hasOwnProperty.call(style, "fg") : false;
  const hasBg = style ? Object.prototype.hasOwnProperty.call(style, "bg") : false;
  const fg = style?.fg !== undefined ? resolveColor(style.fg, "fg") : undefined;
  const bg = style?.bg !== undefined ? resolveColor(style.bg, "bg") : undefined;
  const resolvedStyle = hasFg || hasBg ? { fg, bg } : undefined;

  for (let r = intersection.y; r < intersection.y + intersection.height; r++) {
    for (let c = intersection.x; c < intersection.x + intersection.width; c++) {
      buffer.set(r, c, char, resolvedStyle);
    }
  }
}

function drawTextClipped(
  buffer: Buffer2D,
  row: number,
  col: number,
  text: string,
  style: { fg?: ColorValue; bg?: ColorValue } | undefined,
  clip: Rect,
) {
  row = Math.floor(row);
  col = Math.floor(col);
  if (row < clip.y || row >= clip.y + clip.height) return;
  if (buffer.cols === 0) return;

  const hasFg = style ? Object.prototype.hasOwnProperty.call(style, "fg") : false;
  const hasBg = style ? Object.prototype.hasOwnProperty.call(style, "bg") : false;
  const fg = style?.fg !== undefined ? resolveColor(style.fg, "fg") : undefined;
  const bg = style?.bg !== undefined ? resolveColor(style.bg, "bg") : undefined;
  const resolvedStyle = hasFg || hasBg ? { fg, bg } : undefined;

  // ASCII fast path.
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
      if (currentCol >= clip.x + clip.width) break;
      if (currentCol >= clip.x && currentCol < clip.x + clip.width) {
        buffer.setCodePoint(row, currentCol, code, resolvedStyle);
      }
      currentCol += 1;
    }
    return;
  }

  const segments = segmentGraphemes(text);
  let currentCol = col;

  for (const segment of segments) {
    const width = Math.max(measureGraphemeWidth(segment), 1);
    if (currentCol >= clip.x + clip.width) break;
    if (currentCol + width <= clip.x) {
      currentCol += width;
      continue;
    }

    // Only draw when the glyph origin is inside the clip; partial wide glyphs are skipped.
    if (currentCol >= clip.x && currentCol + width <= clip.x + clip.width) {
      buffer.set(row, currentCol, segment, resolvedStyle);
    }
    currentCol += width;
  }
}

/**
 * Draw the element tree to the buffer.
 */
export function renderElement(
  element: ViewElement,
  buffer: Buffer2D,
  layoutMap: ComputedLayout,
  _parentX = 0,
  _parentY = 0,
  clipRect: Rect = { x: 0, y: 0, width: buffer.cols, height: buffer.rows },
) {
  const key = element.identifier;
  if (!key) return;

  const layout = layoutMap[key];
  if (!layout) return;

  const absX = layout.x + _parentX;
  const absY = layout.y + _parentY;
  const { width, height } = layout;
  const MARGIN = 5;

  if (
    absY >= buffer.rows + MARGIN ||
    absX >= buffer.cols + MARGIN ||
    absY + height <= -MARGIN ||
    absX + width <= -MARGIN
  ) {
    return;
  }

  const elementRect: Rect = {
    x: Math.floor(absX),
    y: Math.floor(absY),
    width: Math.floor(width),
    height: Math.floor(height),
  };
  const elementClip = intersectRect(clipRect, elementRect);
  if (!elementClip) return;

  const bg = element.style?.background;
  if (bg !== undefined) {
    fillRectClipped(
      buffer,
      elementRect,
      " ",
      {
        bg,
        fg: undefined,
      },
      elementClip,
    );
  }

  const outline = element.style?.outline;
  if (outline) {
    const { color, style = "single" } = outline;
    const chars =
      style === "double"
        ? { h: "═", v: "║", tl: "╔", tr: "╗", bl: "╚", br: "╝" }
        : { h: "─", v: "│", tl: "┌", tr: "┐", bl: "└", br: "┘" };

    const x = elementRect.x;
    const y = elementRect.y;
    const w = elementRect.width;
    const h = elementRect.height;

    const borderStyle =
      color !== undefined ? ({ fg: color } satisfies { fg?: ColorValue }) : undefined;

    fillRectClipped(buffer, { x, y, width: w, height: 1 }, chars.h, borderStyle, elementClip);
    fillRectClipped(
      buffer,
      { x, y: y + h - 1, width: w, height: 1 },
      chars.h,
      borderStyle,
      elementClip,
    );
    fillRectClipped(buffer, { x, y, width: 1, height: h }, chars.v, borderStyle, elementClip);
    fillRectClipped(
      buffer,
      { x: x + w - 1, y, width: 1, height: h },
      chars.v,
      borderStyle,
      elementClip,
    );

    drawTextClipped(buffer, y, x, chars.tl, borderStyle, elementClip);
    drawTextClipped(buffer, y, x + w - 1, chars.tr, borderStyle, elementClip);
    drawTextClipped(buffer, y + h - 1, x, chars.bl, borderStyle, elementClip);
    drawTextClipped(buffer, y + h - 1, x + w - 1, chars.br, borderStyle, elementClip);
  }

  if (isText(element)) {
    const fg = element.style?.foreground;
    const bg = element.style?.background;
    const style: { fg?: string | number; bg?: string | number } = {};
    if (fg !== undefined) style.fg = fg;
    if (bg !== undefined) style.bg = bg;
    drawTextClipped(buffer, absY, absX, element.content, style, elementClip);
  }

  if (isBlock(element)) {
    const pad = resolvePadding(element.style?.padding);
    const contentRect: Rect = {
      x: elementRect.x + Math.floor(pad.left),
      y: elementRect.y + Math.floor(pad.top),
      width: Math.max(0, elementRect.width - Math.floor(pad.left) - Math.floor(pad.right)),
      height: Math.max(0, elementRect.height - Math.floor(pad.top) - Math.floor(pad.bottom)),
    };
    const childClip = intersectRect(elementClip, contentRect);
    if (!childClip) return;

    const stack = element.style?.stack;
    if (stack === "z") {
      // Layout engine already overlays children (absolute positioning).
      // Keep normal render recursion so child layout positions are respected.
      for (const child of element.children) {
        renderElement(child, buffer, layoutMap, absX, absY, childClip);
      }
    } else {
      for (const child of element.children) {
        renderElement(child, buffer, layoutMap, absX, absY, childClip);
      }
    }
  }
}
