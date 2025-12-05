import { defineElement } from "../layout";
import { drawText, fillRect } from "../buffer";
import type { BaseElement } from "@btuin/types/elements";
import type { KeyEvent } from "@btuin/types/key-event";
import type { OutlineOptions } from "@btuin/types/styling";
import type { SizeValue } from "@btuin/types/geometry";

export interface ListItem {
  label: string;
  value: string;
}

export interface ListProps extends BaseElement {
  items: ListItem[];
  selected?: number;
  width?: SizeValue;
  height?: SizeValue;
  outline?: OutlineOptions;
  focusKey?: string;
  itemHeight?: number;
  overscan?: number;
}

export interface ListElement extends ListProps {
  type: "list";
}

const selectionState = new Map<string, number>();
const scrollState = new Map<string, number>();

/**
 * Calculate visible range based on scroll position and viewport height
 */
function getVisibleRange(
  scrollTop: number,
  viewportHeight: number,
  itemCount: number,
  itemHeight: number,
  overscan: number,
): { start: number; end: number } {
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    itemCount,
    Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan,
  );
  return { start: startIndex, end: endIndex };
}

/**
 * Ensure selected item is visible in viewport
 */
function ensureSelectedInView(
  selectedIndex: number,
  scrollTop: number,
  viewportHeight: number,
  itemHeight: number,
): number {
  const itemTop = selectedIndex * itemHeight;
  const itemBottom = itemTop + itemHeight;

  if (itemTop < scrollTop) {
    return itemTop;
  }
  if (itemBottom > scrollTop + viewportHeight) {
    return Math.max(0, itemBottom - viewportHeight);
  }
  return scrollTop;
}

/**
 *
 */
export const List = defineElement<ListElement>("list", {
  render(element, buf) {
    const rect = element.innerRect ?? element.rect;
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

    const itemHeight = element.itemHeight ?? 1;
    const overscan = element.overscan ?? 2;
    const focusKey = element.focusKey || "default";

    const current = getSelectedIndex(element);
    let scrollTop = scrollState.get(focusKey) ?? 0;

    // Ensure selected item is visible
    scrollTop = ensureSelectedInView(current, scrollTop, rect.height, itemHeight);
    scrollState.set(focusKey, scrollTop);

    // Get visible range with overscan
    const { start, end } = getVisibleRange(
      scrollTop,
      rect.height,
      element.items.length,
      itemHeight,
      overscan,
    );

    // Fill background
    fillRect(buf, rect.y, rect.x, rect.width, rect.height, " ");

    // Render visible items only (virtualization)
    let renderY = rect.y;
    for (let i = start; i < end && renderY < rect.y + rect.height; i++) {
      const item = element.items[i];
      if (!item) break;

      const isSelected = i === current;
      const prefix = isSelected ? "▶ " : "  ";
      const text = `${prefix}${item.label}`.slice(0, rect.width);

      drawText(buf, renderY, rect.x, text.padEnd(rect.width, " "), {
        fg: isSelected ? "magenta" : "white",
      });

      renderY += itemHeight;
    }

    // Render scrollbar indicator if needed
    if (element.items.length * itemHeight > rect.height) {
      const scrollbarHeight = Math.max(
        1,
        Math.floor((rect.height * rect.height) / (element.items.length * itemHeight)),
      );
      const scrollbarPosition = Math.floor(
        (scrollTop * rect.height) / (element.items.length * itemHeight),
      );

      for (let i = 0; i < scrollbarHeight; i++) {
        const barY = rect.y + scrollbarPosition + i;
        if (barY >= rect.y && barY < rect.y + rect.height) {
          drawText(buf, barY, rect.x + rect.width - 1, "▌", {
            fg: "magenta",
          });
        }
      }
    }
  },

  handleKey(element, key: KeyEvent) {
    if (!element.focusKey || element.items.length === 0) return false;

    const current = getSelectedIndex(element);
    const focusKey = element.focusKey;
    const itemHeight = element.itemHeight ?? 1;
    const rect = element.innerRect ?? element.rect;
    if (!rect) return false;

    let next = current;
    let scrollTop = scrollState.get(focusKey) ?? 0;

    if (key.name === "down" || key.name === "j") {
      next = Math.min(current + 1, element.items.length - 1);
    } else if (key.name === "up" || key.name === "k") {
      next = Math.max(current - 1, 0);
    } else if (key.name === "pagedown") {
      next = Math.min(current + Math.floor(rect.height / itemHeight), element.items.length - 1);
      scrollTop = Math.min(
        scrollTop + rect.height,
        Math.max(0, element.items.length * itemHeight - rect.height),
      );
    } else if (key.name === "pageup") {
      next = Math.max(current - Math.floor(rect.height / itemHeight), 0);
      scrollTop = Math.max(scrollTop - rect.height, 0);
    } else if (key.name === "home") {
      next = 0;
      scrollTop = 0;
    } else if (key.name === "end") {
      next = element.items.length - 1;
      scrollTop = Math.max(0, element.items.length * itemHeight - rect.height);
    } else {
      return false;
    }

    selectionState.set(focusKey, next);
    scrollState.set(focusKey, scrollTop);
    return true;
  },
});

function getSelectedIndex(element: ListElement): number {
  const focusKey = element.focusKey || "default";
  if (selectionState.has(focusKey)) {
    return selectionState.get(focusKey)!;
  }
  return Math.max(0, Math.min(element.items.length - 1, element.selected ?? 0));
}
