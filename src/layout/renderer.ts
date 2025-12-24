import type { ComputedLayout } from "../layout-engine/types";
import { drawText, fillRect } from "../renderer";
import type { Buffer2D } from "../renderer/types";
import { isBlock, isText, type ViewElement } from "../view/types/elements";

/**
 * Draw the element tree to the buffer.
 */
export function renderElement(
  element: ViewElement,
  buffer: Buffer2D,
  layoutMap: ComputedLayout,
  _parentX = 0,
  _parentY = 0,
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

  const bg = element.style?.background;
  if (bg !== undefined) {
    fillRect(
      buffer,
      Math.floor(absY),
      Math.floor(absX),
      Math.floor(width),
      Math.floor(height),
      " ",
      {
        bg,
        fg: undefined,
      },
    );
  }

  const outline = element.style?.outline;
  if (outline) {
    const { color, style = "single" } = outline;
    const chars =
      style === "double"
        ? { h: "═", v: "║", tl: "╔", tr: "╗", bl: "╚", br: "╝" }
        : { h: "─", v: "│", tl: "┌", tr: "┐", bl: "└", br: "┘" };

    const x = Math.floor(absX);
    const y = Math.floor(absY);
    const w = Math.floor(width);
    const h = Math.floor(height);

    const borderStyle = color !== undefined ? { fg: color } : undefined;

    fillRect(buffer, y, x, w, 1, chars.h, borderStyle);
    fillRect(buffer, y + h - 1, x, w, 1, chars.h, borderStyle);
    fillRect(buffer, y, x, 1, h, chars.v, borderStyle);
    fillRect(buffer, y, x + w - 1, 1, h, chars.v, borderStyle);

    drawText(buffer, y, x, chars.tl, borderStyle);
    drawText(buffer, y, x + w - 1, chars.tr, borderStyle);
    drawText(buffer, y + h - 1, x, chars.bl, borderStyle);
    drawText(buffer, y + h - 1, x + w - 1, chars.br, borderStyle);
  }

  if (isText(element)) {
    const fg = element.style?.foreground;
    const bg = element.style?.background;
    const style: { fg?: string | number; bg?: string | number } = {};
    if (fg !== undefined) style.fg = fg;
    if (bg !== undefined) style.bg = bg;
    drawText(buffer, Math.floor(absY), Math.floor(absX), element.content, style);
  }

  if (isBlock(element)) {
    const stack = element.style?.stack;
    if (stack === "z") {
      // Layout engine already overlays children (absolute positioning).
      // Keep normal render recursion so child layout positions are respected.
      for (const child of element.children) {
        renderElement(child, buffer, layoutMap, absX, absY);
      }
    } else {
      for (const child of element.children) {
        renderElement(child, buffer, layoutMap, absX, absY);
      }
    }
  }
}
