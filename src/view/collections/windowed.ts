import type { BlockElement } from "../primitives/block";
import type { ViewElement } from "../types/elements";
import { ViewportSlice } from "./viewport-slice";

export interface WindowedOptions<T> {
  items: readonly T[];
  /**
   * Index of the first visible item (0-based).
   *
   * Defaults to 0.
   */
  startIndex?: number;
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

export type WindowedMetrics = {
  viewportRows: number;
  visibleCount: number;
  maxStartIndex: number;
  startIndex: number;
  endIndex: number;
};

export type WindowedMetricsInput = {
  itemCount: number;
  startIndex?: number;
  viewportRows?: number;
  itemHeight?: number;
  overscan?: number;
};

function getFallbackViewportRows(): number {
  // Fallback to terminal height when available; keep a sane default for tests/CI.
  const rows = (process.stdout as { rows?: number } | undefined)?.rows;
  return typeof rows === "number" && Number.isFinite(rows) ? Math.max(0, Math.trunc(rows)) : 24;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const v = Math.trunc(value);
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

export function getWindowedMetrics(input: WindowedMetricsInput): WindowedMetrics {
  const safeItemCount = Math.max(0, Math.trunc(input.itemCount));
  const safeItemHeight = Math.max(1, Math.trunc(input.itemHeight ?? 1));
  const safeOverscan = Math.max(0, Math.trunc(input.overscan ?? 2));
  const safeViewportRows = Math.max(0, Math.trunc(input.viewportRows ?? getFallbackViewportRows()));

  const visibleCount =
    safeViewportRows === 0 ? 0 : Math.ceil(safeViewportRows / safeItemHeight) + safeOverscan;
  const maxStartIndex = Math.max(0, safeItemCount - Math.max(0, visibleCount));
  const startIndex = clampInt(input.startIndex ?? 0, 0, safeItemCount === 0 ? 0 : maxStartIndex);
  const endIndex = Math.min(safeItemCount, startIndex + visibleCount);

  return { viewportRows: safeViewportRows, visibleCount, maxStartIndex, startIndex, endIndex };
}

export function clampWindowedStartIndex(input: WindowedMetricsInput): number {
  return getWindowedMetrics(input).startIndex;
}

/**
 * User-facing windowed list helper.
 *
 * This version does not require `viewportRows`; it uses the current terminal
 * height as a conservative bound. For more control, use `ViewportSlice`.
 */
export function Windowed<T>(options: WindowedOptions<T>): BlockElement {
  const metrics = getWindowedMetrics({
    itemCount: options.items.length,
    startIndex: options.startIndex ?? 0,
    itemHeight: options.itemHeight,
    overscan: options.overscan,
  });
  return ViewportSlice({
    items: options.items,
    startIndex: metrics.startIndex,
    viewportRows: metrics.viewportRows,
    itemHeight: options.itemHeight,
    overscan: options.overscan,
    keyPrefix: options.keyPrefix,
    renderItem: options.renderItem,
  });
}
