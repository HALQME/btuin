import { Block, type BlockElement } from "../primitives/block";
import type { ViewElement } from "../types/elements";

export interface WindowedOptions<T> {
  items: readonly T[];
  /**
   * Index of the first visible item (0-based).
   *
   * Clamp this in your state update logic; this function clamps defensively too.
   */
  startIndex: number;
  /** Viewport height in terminal rows (cells). */
  viewportRows: number;
  /** Fixed item height in rows (cells). */
  itemHeight?: number;
  /**
   * Extra items to render after the viewport to reduce pop-in.
   *
   * Note: items before `startIndex` are not rendered (no negative offsets).
   */
  overscan?: number;
  /**
   * Optional stable key prefix for item keys when the returned elements don't
   * already have `key`/`identifier`.
   */
  keyPrefix?: string;
  renderItem: (item: T, index: number) => ViewElement;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const v = Math.trunc(value);
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

/**
 * Renders a "window" (visible slice) of a large item collection.
 *
 * This is a view-level helper that returns a `Block` with only the visible
 * children, reducing render traversal costs for very large lists.
 */
export function Windowed<T>(options: WindowedOptions<T>): BlockElement {
  const { items, renderItem, viewportRows, itemHeight = 1, overscan = 2, keyPrefix } = options;

  const safeItemHeight = Math.max(1, Math.trunc(itemHeight));
  const safeViewportRows = Math.max(0, Math.trunc(viewportRows));
  const safeOverscan = Math.max(0, Math.trunc(overscan));

  const firstIndex = clampInt(options.startIndex, 0, Math.max(0, items.length - 1));
  const visibleCount =
    safeViewportRows === 0 ? 0 : Math.ceil(safeViewportRows / safeItemHeight) + safeOverscan;
  const endIndex = Math.min(items.length, firstIndex + visibleCount);

  const children: ViewElement[] = [];
  for (let i = firstIndex; i < endIndex; i++) {
    const child = renderItem(items[i]!, i);
    // Windowed rendering relies on overflow+clipping; avoid flexbox shrinking items
    // when overscan makes total child height exceed the viewport.
    if (child.style?.flexShrink === undefined) {
      child.style.flexShrink = 0;
    }
    if (safeItemHeight !== 1 && child.style?.height === undefined) {
      child.style.height = safeItemHeight;
    }
    if (keyPrefix && !child.key && !child.identifier) {
      const k = `${keyPrefix}/${i}`;
      child.key = k;
      child.identifier = k;
    }
    children.push(child);
  }

  const container = Block(...children).direction("column");
  container.style.scrollRegion = true;
  // Prevent overscan items from affecting parent flex layout sizing.
  // With no explicit height, the container's "base size" becomes children sum,
  // which can exceed the viewport and cause siblings (e.g. headers) to shrink to 0 rows.
  if (container.style.height === undefined) {
    container.style.height = safeViewportRows;
  }
  if (container.style.flexShrink === undefined) {
    container.style.flexShrink = 0;
  }
  return container;
}
