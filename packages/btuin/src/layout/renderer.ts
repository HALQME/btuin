import { type ViewElement, isBlock, isText } from "../view/types/elements";
import type { ComputedLayout } from "@btuin/layout-engine";
import { type Buffer2D, drawText, fillRect } from "@btuin/renderer";

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
  const key = element.key;
  if (!key) return;

  const layout = layoutMap[key];
  if (!layout) return;

  // Layout engine coordinates are already in the root coordinate space.
  const absX = layout.x + _parentX;
  const absY = layout.y + _parentY;
  const { width, height } = layout;

  // 1. Draw background
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
      },
    );
  }

  // 2. Draw border (if outline property exists)
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

    // Draw lines
    fillRect(buffer, y, x, w, 1, chars.h, { fg: color });
    fillRect(buffer, y + h - 1, x, w, 1, chars.h, { fg: color });
    fillRect(buffer, y, x, 1, h, chars.v, { fg: color });
    fillRect(buffer, y, x + w - 1, 1, h, chars.v, { fg: color });

    // Draw corners
    drawText(buffer, y, x, chars.tl, { fg: color });
    drawText(buffer, y, x + w - 1, chars.tr, { fg: color });
    drawText(buffer, y + h - 1, x, chars.bl, { fg: color });
    drawText(buffer, y + h - 1, x + w - 1, chars.br, { fg: color });
  }

  // 3. Draw content
  if (isText(element)) {
    const fg = element.style?.foreground;
    const bg = element.style?.background;
    drawText(buffer, Math.floor(absY), Math.floor(absX), element.content, { fg, bg });
  }

  // 4. Recursively draw children
  if (isBlock(element)) {
    for (const child of element.children) {
      renderElement(child, buffer, layoutMap, absX, absY);
    }
  }
}
