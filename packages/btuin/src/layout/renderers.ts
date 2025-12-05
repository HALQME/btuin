import { drawText, setCell, type Buffer2D } from "../buffer";
import type { ColorValue } from "@btuin/types/color";
import type { ViewElement, LaidOutElement } from "@btuin/types/elements";
import { getElementModule } from "./element-registry";

export function renderElement(
  element: LaidOutElement,
  buf: Buffer2D,
  options?: { activeFocusKey?: string },
) {
  const module = getElementModule(element.type);
  const opts = options ?? { activeFocusKey: undefined };
  const isFocused = Boolean(element.focusKey && element.focusKey === opts.activeFocusKey);
  const shouldOutline = Boolean(
    (element.outline || isFocused) && element.rect.width > 1 && element.rect.height > 1,
  );

  if (module?.render) {
    module.render(element as ViewElement, buf, opts, {
      renderChild: (child: ViewElement) => {
        const laidChild = child as LaidOutElement;
        return renderElement(laidChild, buf, opts);
      },
    });
  } else {
    throw new Error(`No render module registered for type "${element.type}"`);
  }

  if (shouldOutline) {
    drawOutline(buf, element.rect, element.outline, isFocused);
  }
}

function drawOutline(
  buf: Buffer2D,
  rect: RectLike,
  outline?: { color?: ColorValue; title?: string },
  focused?: boolean,
) {
  const color: ColorValue | undefined = outline?.color ?? (focused ? "cornflowerblue" : undefined);
  const top = rect.y;
  const bottom = rect.y + rect.height - 1;
  const left = rect.x;
  const right = rect.x + rect.width - 1;

  for (let x = left; x <= right; x++) {
    setCell(buf, top, x, { ch: "─", fg: color });
    setCell(buf, bottom, x, { ch: "─", fg: color });
  }

  for (let y = top; y <= bottom; y++) {
    setCell(buf, y, left, { ch: "│", fg: color });
    setCell(buf, y, right, { ch: "│", fg: color });
  }

  setCell(buf, top, left, { ch: "┌", fg: color });
  setCell(buf, top, right, { ch: "┐", fg: color });
  setCell(buf, bottom, left, { ch: "└", fg: color });
  setCell(buf, bottom, right, { ch: "┘", fg: color });

  if (outline?.title && rect.width > 4) {
    const titleText = ` ${outline.title} `;
    drawText(buf, top, left + 2, titleText.slice(0, rect.width - 4), { fg: color });
  }
}

interface RectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}
