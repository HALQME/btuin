import { effect, stop, type ReactiveEffect } from "../reactivity";
import { FlatBuffer, getGlobalBufferPool, renderDiff } from "../renderer";
import { layout, renderElement } from "../layout";
import type { DiffStats } from "../renderer/diff";
import type { Buffer2D } from "../renderer/types";
import { isBlock, type ViewElement } from "../view/types/elements";
import { createErrorContext } from "./error-boundary";
import type { Profiler } from "./profiler";
import type { ComputedLayout } from "../layout-engine/types";

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
  let renderEffect: ReactiveEffect | null = null;

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
      if (config.profiler && frame) {
        config.profiler.measure(frame, "renderMs", () => {
          deps.renderElement(rootElement, buf, layoutResult, 0, 0, {
            x: 0,
            y: 0,
            width: state.currentSize.cols,
            height: state.currentSize.rows,
          });
        });
      } else {
        deps.renderElement(rootElement, buf, layoutResult, 0, 0, {
          x: 0,
          y: 0,
          width: state.currentSize.cols,
          height: state.currentSize.rows,
        });
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
