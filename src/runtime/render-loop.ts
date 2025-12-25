import { effect, stop, type ReactiveEffect } from "../reactivity";
import { FlatBuffer, getGlobalBufferPool, renderDiff } from "../renderer";
import { layout, renderElement } from "../layout";
import type { DiffStats } from "../renderer/diff";
import type { Buffer2D } from "../renderer/types";
import { isBlock, type ViewElement } from "../view/types/elements";
import { createErrorContext } from "./error-boundary";
import type { Profiler } from "./profiler";
import type { ComputedLayout } from "../layout-engine/types";

type Rect = { x: number; y: number; width: number; height: number };

export interface BufferPoolLike {
  acquire(): Buffer2D;
  release(buffer: Buffer2D): void;
}

export interface RenderLoopDeps {
  FlatBuffer: typeof FlatBuffer;
  getGlobalBufferPool: (rows: number, cols: number) => BufferPoolLike;
  renderDiff: (prev: Buffer2D, next: Buffer2D, stats?: DiffStats) => string;
  layout: (root: ViewElement, containerSize?: { width: number; height: number }) => ComputedLayout;
  renderElement: (
    element: ViewElement,
    buffer: Buffer2D,
    layoutMap: ComputedLayout,
    parentX?: number,
    parentY?: number,
    clipRect?: { x: number; y: number; width: number; height: number },
  ) => void;
}

const defaultDeps: RenderLoopDeps = {
  FlatBuffer,
  getGlobalBufferPool,
  renderDiff,
  layout,
  renderElement,
};

/**
 * Terminal size configuration
 */
export interface TerminalSize {
  rows: number;
  cols: number;
}

/**
 * Render loop configuration
 */
export interface RenderLoopConfig<State> {
  /** Function to get current terminal size */
  getSize: () => TerminalSize;
  /** Function to write output to the terminal */
  write: (output: string) => void;
  /** Function to generate view from state */
  view: (state: State) => ViewElement;
  /** Function to get current state */
  getState: () => State;
  /** Optional hook after layout is computed (before render) */
  onLayout?: (args: {
    size: TerminalSize;
    rootElement: ViewElement;
    layoutMap: ComputedLayout;
  }) => void;
  /** Error handler */
  handleError: (context: import("./error-boundary").ErrorContext) => void;
  /** Optional profiler */
  profiler?: Profiler;
  /** Optional dependency overrides (avoid `mock.module()` leakage between tests) */
  deps?: Partial<RenderLoopDeps>;
}

/**
 * Render loop state
 */
interface RenderLoopState {
  currentSize: TerminalSize;
  prevBuffer: Buffer2D;
}

/**
 * Creates a renderer function that handles the rendering loop
 *
 * @param config - Render loop configuration
 * @returns Object containing render function and state getter
 */
export function createRenderer<State>(config: RenderLoopConfig<State>) {
  const deps: RenderLoopDeps = { ...defaultDeps, ...config.deps };

  // Initialize with current size
  const initialSize = config.getSize();

  // Buffer pool tied to current terminal size
  let pool = deps.getGlobalBufferPool(initialSize.rows, initialSize.cols);

  let state: RenderLoopState = {
    currentSize: initialSize,
    prevBuffer: pool.acquire(),
  };

  let prevRootElement: ViewElement | null = null;
  let prevLayoutResult: ComputedLayout | null = null;
  let prevLayoutSizeKey: string | null = null;
  let prevAbsRects: Map<string, Rect> | null = null;
  let prevRenderSigs: Map<string, string> | null = null;
  let renderEffect: ReactiveEffect | null = null;

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

  function collectAbsRectsAndFindScrollRegion(
    root: ViewElement,
    layoutMap: ComputedLayout,
  ): {
    rects: Map<string, Rect>;
    sigs: Map<string, string>;
    scrollRegion: { band: { top: number; bottom: number }; fullWidth: boolean } | null;
  } {
    const rects = new Map<string, Rect>();
    const sigs = new Map<string, string>();
    let scrollRegion: { band: { top: number; bottom: number }; fullWidth: boolean } | null = null;

    const signatureOf = (element: ViewElement): string => {
      const bg = element.style?.background;
      const fg = element.style?.foreground;
      const outline = element.style?.outline;
      const padding = element.style?.padding;

      if (element.type === "text") {
        return `t|${element.content}|fg:${fg ?? ""}|bg:${bg ?? ""}`;
      }
      if (element.type === "input") {
        return `i|${element.value}|fg:${fg ?? ""}|bg:${bg ?? ""}`;
      }
      // block
      const outlineKey =
        outline === undefined ? "" : `o:${outline.style ?? "single"}:${outline.color ?? ""}`;
      const paddingKey =
        padding === undefined
          ? ""
          : typeof padding === "number"
            ? `p:${padding}`
            : `p:${padding.join(",")}`;
      return `b|bg:${bg ?? ""}|${outlineKey}|${paddingKey}`;
    };

    const walk = (element: ViewElement, parentX: number, parentY: number) => {
      const key = element.identifier;
      if (!key) return;
      const layout = layoutMap[key];
      if (!layout) return;

      const absX = layout.x + parentX;
      const absY = layout.y + parentY;
      const rect: Rect = {
        x: Math.floor(absX),
        y: Math.floor(absY),
        width: Math.floor(layout.width),
        height: Math.floor(layout.height),
      };
      rects.set(key, rect);
      sigs.set(key, signatureOf(element));

      if (isBlock(element)) {
        for (const child of element.children) {
          walk(child, absX, absY);
        }
      }

      if (!scrollRegion && element.style?.scrollRegion) {
        const pad = resolvePadding(element.style?.padding);
        const contentRect: Rect = {
          x: rect.x,
          y: rect.y + Math.floor(pad.top),
          width: rect.width,
          height: Math.max(0, rect.height - Math.floor(pad.top) - Math.floor(pad.bottom)),
        };
        const screen = {
          x: 0,
          y: 0,
          width: state.currentSize.cols,
          height: state.currentSize.rows,
        };
        const content = intersectRect(contentRect, screen);
        if (content) {
          scrollRegion = {
            band: { top: content.y, bottom: content.y + content.height - 1 },
            fullWidth: content.x === 0 && content.width === screen.width,
          };
        }
      }
    };

    walk(root, 0, 0);
    return { rects, sigs, scrollRegion };
  }

  /**
   * Performs a render cycle
   *
   * @param forceFullRedraw - Force a full redraw (useful for resize)
   */
  function renderOnce(forceFullRedraw = false): void {
    try {
      const newSize = config.getSize();
      const sizeChanged =
        newSize.rows !== state.currentSize.rows || newSize.cols !== state.currentSize.cols;

      if (sizeChanged || forceFullRedraw) {
        // When size changes, re-create a pool bound to the new dimensions
        state.currentSize = newSize;
        pool = deps.getGlobalBufferPool(state.currentSize.rows, state.currentSize.cols);

        // Return previous buffer to the old pool (if any) and acquire a fresh one
        pool.release(state.prevBuffer);
        state.prevBuffer = pool.acquire();
      }

      const rootElement = config.view(config.getState());
      const layoutSizeKey = `${state.currentSize.cols}x${state.currentSize.rows}`;

      const nodeCount =
        config.profiler?.isEnabled() && config.profiler.options.nodeCount
          ? countElements(rootElement)
          : undefined;
      const frame = config.profiler?.beginFrame(state.currentSize, { nodeCount }) ?? null;

      const layoutResult =
        rootElement === prevRootElement &&
        prevLayoutResult &&
        prevLayoutSizeKey === layoutSizeKey &&
        !sizeChanged
          ? prevLayoutResult
          : (config.profiler?.measure(frame, "layoutMs", () =>
              deps.layout(rootElement, {
                width: state.currentSize.cols,
                height: state.currentSize.rows,
              }),
            ) ??
            deps.layout(rootElement, {
              width: state.currentSize.cols,
              height: state.currentSize.rows,
            }));

      prevRootElement = rootElement;
      prevLayoutResult = layoutResult;
      prevLayoutSizeKey = layoutSizeKey;

      const previousRects = prevAbsRects;
      const previousSigs = prevRenderSigs;
      const {
        rects: absRects,
        sigs,
        scrollRegion,
      } = collectAbsRectsAndFindScrollRegion(rootElement, layoutResult);

      prevAbsRects = absRects;
      prevRenderSigs = sigs;

      try {
        config.onLayout?.({ size: state.currentSize, rootElement, layoutMap: layoutResult });
      } catch {
        // ignore devtools hook failures
      }

      let buf = pool.acquire();
      if (buf === state.prevBuffer) {
        // Ensure prev/next buffers differ; diffing the same instance yields no output.
        buf = pool.acquire();
        if (buf === state.prevBuffer) {
          buf = new deps.FlatBuffer(state.currentSize.rows, state.currentSize.cols);
        }
      }
      const fullClip: Rect = {
        x: 0,
        y: 0,
        width: state.currentSize.cols,
        height: state.currentSize.rows,
      };

      const tryScrollFastPath = (): { clips: Rect[] } | null => {
        if (process.env.BTUIN_DISABLE_SCROLL_FASTPATH === "1") return null;
        if (sizeChanged || forceFullRedraw) return null;
        if (!previousRects || !absRects || !scrollRegion) return null;
        if (!scrollRegion.fullWidth) return null;

        const { top, bottom } = scrollRegion.band;
        const bandHeight = bottom - top + 1;
        if (bandHeight <= 1) return null;

        // Terminal scroll regions are full-width; skip when the band isn't.
        if (fullClip.width <= 0) return null;

        const maxShift = Math.min(40, bandHeight - 1);
        const counts = new Map<number, number>();
        let compared = 0;

        for (const [key, prevRect] of previousRects) {
          const nextRect = absRects.get(key);
          if (!nextRect) continue;

          const prevIn = prevRect.y >= top && prevRect.y <= bottom;
          const nextIn = nextRect.y >= top && nextRect.y <= bottom;
          if (!prevIn || !nextIn) continue;

          if (
            prevRect.x !== nextRect.x ||
            prevRect.width !== nextRect.width ||
            prevRect.height !== nextRect.height
          ) {
            continue;
          }

          const dy = nextRect.y - prevRect.y;
          if (dy === 0) continue;
          if (Math.abs(dy) > maxShift) continue;

          counts.set(dy, (counts.get(dy) ?? 0) + 1);
          compared++;
        }

        if (compared < 3) return null;

        let bestDy = 0;
        let bestCount = 0;
        for (const [dy, count] of counts) {
          if (count > bestCount) {
            bestCount = count;
            bestDy = dy;
          }
        }
        if (bestDy === 0) return null;
        if (bestCount / compared < 0.6) return null;

        // Verify that things outside the band don't move, and inside the band only translate.
        for (const [key, prevRect] of previousRects) {
          const nextRect = absRects.get(key);
          if (!nextRect) continue;

          const prevIn = prevRect.y >= top && prevRect.y <= bottom;
          const nextIn = nextRect.y >= top && nextRect.y <= bottom;

          if (!prevIn && !nextIn) {
            if (
              prevRect.x !== nextRect.x ||
              prevRect.y !== nextRect.y ||
              prevRect.width !== nextRect.width ||
              prevRect.height !== nextRect.height
            ) {
              return null;
            }
            continue;
          }

          if (prevIn && nextIn) {
            if (
              prevRect.x !== nextRect.x ||
              prevRect.width !== nextRect.width ||
              prevRect.height !== nextRect.height ||
              nextRect.y !== prevRect.y + bestDy
            ) {
              return null;
            }
          }
        }

        const scrollTop = top;
        const scrollBottom = bottom;
        const dy = bestDy;

        const exposedHeight = Math.abs(dy);
        if (exposedHeight <= 0) return null;

        const exposedY = dy < 0 ? scrollBottom - exposedHeight + 1 : scrollTop;

        if (!previousSigs || !sigs) return null;

        // Bail if something outside the scroll band was removed (hard to "erase" safely).
        for (const key of previousSigs.keys()) {
          if (sigs.has(key)) continue;
          const prevRect = previousRects.get(key);
          if (!prevRect) continue;
          const prevIn = prevRect.y >= top && prevRect.y <= bottom;
          if (!prevIn) return null;
        }

        const clips: Rect[] = [];
        clips.push({ x: 0, y: exposedY, width: fullClip.width, height: exposedHeight });

        // Also redraw any elements outside the scroll band whose render-relevant props changed.
        for (const [key, sig] of sigs) {
          const prevSig = previousSigs.get(key);
          if (prevSig === undefined || prevSig === sig) continue;
          const rect = absRects.get(key);
          if (!rect) continue;
          const inBand = rect.y >= top && rect.y <= bottom;
          if (inBand) continue;

          const clipped = intersectRect(rect, fullClip);
          if (clipped) clips.push(clipped);
        }

        // Build next buffer from prev by scrolling the band, then only render the newly exposed rows.
        buf.copyFrom(state.prevBuffer);
        buf.scrollRowsFrom(state.prevBuffer, scrollTop, scrollBottom, dy);

        return { clips };
      };

      const scrollFast = tryScrollFastPath();

      if (config.profiler && frame) {
        config.profiler.measure(frame, "renderMs", () => {
          if (scrollFast) {
            for (const clip of scrollFast.clips) {
              deps.renderElement(rootElement, buf, layoutResult, 0, 0, clip);
            }
          } else {
            deps.renderElement(rootElement, buf, layoutResult, 0, 0, fullClip);
          }
        });
      } else {
        if (scrollFast) {
          for (const clip of scrollFast.clips) {
            deps.renderElement(rootElement, buf, layoutResult, 0, 0, clip);
          }
        } else {
          deps.renderElement(rootElement, buf, layoutResult, 0, 0, fullClip);
        }
      }

      config.profiler?.drawHud(buf);

      const diffStats: DiffStats | undefined = frame
        ? {
            sizeChanged: false,
            fullRedraw: false,
            changedCells: 0,
            cursorMoves: 0,
            fgChanges: 0,
            bgChanges: 0,
            resets: 0,
            ops: 0,
          }
        : undefined;

      const prevForDiff = forceFullRedraw
        ? new deps.FlatBuffer(state.currentSize.rows, state.currentSize.cols)
        : state.prevBuffer;

      const output =
        config.profiler?.measure(frame, "diffMs", () =>
          deps.renderDiff(prevForDiff, buf, diffStats),
        ) ?? deps.renderDiff(prevForDiff, buf);
      const safeOutput =
        output === ""
          ? deps.renderDiff(
              new deps.FlatBuffer(state.currentSize.rows, state.currentSize.cols),
              buf,
            )
          : output;
      if (frame && diffStats) {
        config.profiler?.recordDiffStats(frame, diffStats);
      }
      if (safeOutput) {
        config.profiler?.recordOutput(frame, safeOutput);
        if (config.profiler && frame) {
          config.profiler.measure(frame, "writeMs", () => config.write(safeOutput));
        } else {
          config.write(safeOutput);
        }
      }

      // Return old prev buffer to the pool and keep the new one
      pool.release(state.prevBuffer);
      state.prevBuffer = buf;

      config.profiler?.endFrame(frame);
    } catch (error) {
      config.handleError(createErrorContext("render", error));
    }
  }

  function render(): ReactiveEffect {
    if (renderEffect) {
      stop(renderEffect);
    }
    renderEffect = effect(() => renderOnce(false));
    return renderEffect;
  }

  /**
   * Gets the current render loop state
   */
  function getState(): RenderLoopState {
    return state;
  }

  function dispose() {
    if (renderEffect) {
      stop(renderEffect);
    }
  }

  return {
    render,
    renderOnce,
    dispose,
    getState,
  };
}

function countElements(root: ViewElement): number {
  let count = 1;
  if (isBlock(root)) {
    for (const child of root.children) count += countElements(child);
  }
  return count;
}
