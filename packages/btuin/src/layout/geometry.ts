import type { BaseElement, ViewElement } from "@btuin/types/elements";
import type { Rect, SizeValue } from "@btuin/types/geometry";

export function resolveContentRect(element: BaseElement, rect: Rect): Rect {
  if ((element.outline || element.focusKey) && rect.width > 2 && rect.height > 2) {
    return {
      x: rect.x + 1,
      y: rect.y + 1,
      width: rect.width - 2,
      height: rect.height - 2,
    };
  }
  return rect;
}

export function resolveDimension(value: SizeValue | undefined, parent: number): number {
  if (typeof value === "number") {
    return Math.max(1, Math.min(parent, Math.floor(value)));
  }
  return parent;
}

export function resolveSizes(
  children: ViewElement[],
  totalSize: number,
  gap: number,
  dimension: "width" | "height",
): number[] {
  const count = children.length;
  if (count === 0) return [];

  const available = Math.max(0, totalSize - gap * Math.max(0, count - 1));
  let remaining = available;
  const autoIndices: number[] = [];
  const result: number[] = Array.from({ length: count }, () => 1);

  children.forEach((child, index) => {
    const sizeValue = dimension === "width" ? child.width : child.height;
    if (typeof sizeValue === "number") {
      const value = Math.max(1, Math.floor(sizeValue));
      result[index] = Math.min(value, remaining);
      remaining -= result[index];
      if (remaining < 0) remaining = 0;
    } else {
      autoIndices.push(index);
    }
  });

  if (autoIndices.length > 0) {
    const autoSize = Math.max(1, Math.floor(remaining / autoIndices.length));
    for (const index of autoIndices) {
      if (result[index] !== undefined) {
        result[index] = autoSize;
      }
    }
    let leftover = remaining - autoSize * autoIndices.length;
    for (const index of autoIndices) {
      if (leftover <= 0) break;
      if (result[index] !== undefined) {
        result[index] += 1;
      }
      leftover -= 1;
    }
  }

  return result;
}
