/**
 * Render Loop Module
 *
 * Handles the rendering loop, including buffer management and diff rendering.
 */

import { getGlobalBufferPool, renderDiff, type Buffer2D, type DiffStats } from "@btuin/renderer";
import { layout, renderElement } from "../layout";
import type { ViewElement } from "../view/types/elements";
import { isBlock } from "../view/types/elements";
import { createErrorContext } from "./error-boundary";
import type { Profiler } from "./profiler";

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
  /** Error handler */
  handleError: (context: import("./error-boundary").ErrorContext) => void;
  /** Optional profiler */
  profiler?: Profiler;
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
  // Initialize with current size
  const initialSize = config.getSize();

  // Buffer pool tied to current terminal size
  let pool = getGlobalBufferPool(initialSize.rows, initialSize.cols);

  let state: RenderLoopState = {
    currentSize: initialSize,
    prevBuffer: pool.acquire(),
  };

  /**
   * Performs a render cycle
   *
   * @param forceFullRedraw - Force a full redraw (useful for resize)
   */
  function render(forceFullRedraw = false): void {
    try {
      const newSize = config.getSize();
      const sizeChanged =
        newSize.rows !== state.currentSize.rows || newSize.cols !== state.currentSize.cols;

      if (sizeChanged || forceFullRedraw) {
        // When size changes, re-create a pool bound to the new dimensions
        state.currentSize = newSize;
        pool = getGlobalBufferPool(state.currentSize.rows, state.currentSize.cols);

        // Return previous buffer to the old pool (if any) and acquire a fresh one
        pool.release(state.prevBuffer);
        state.prevBuffer = pool.acquire();
      }

      const rootElement = config.view(config.getState());

      const nodeCount =
        config.profiler?.isEnabled() && config.profiler.options.nodeCount
          ? countElements(rootElement)
          : undefined;
      const frame = config.profiler?.beginFrame(state.currentSize, { nodeCount }) ?? null;

      const layoutResult =
        config.profiler?.measure(frame, "layoutMs", () =>
          layout(rootElement, {
            width: state.currentSize.cols,
            height: state.currentSize.rows,
          }),
        ) ??
        layout(rootElement, {
          width: state.currentSize.cols,
          height: state.currentSize.rows,
        });

      const buf = pool.acquire();
      config.profiler?.measure(frame, "renderMs", () => {
        renderElement(rootElement, buf, layoutResult, 0, 0);
      });

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

      const output =
        config.profiler?.measure(frame, "diffMs", () =>
          renderDiff(state.prevBuffer, buf, diffStats),
        ) ?? renderDiff(state.prevBuffer, buf);
      if (frame && diffStats) {
        config.profiler?.recordDiffStats(frame, diffStats);
      }
      if (output) {
        config.profiler?.recordOutput(frame, output);
        config.profiler?.measure(frame, "writeMs", () => config.write(output));
      }

      // Return old prev buffer to the pool and keep the new one
      pool.release(state.prevBuffer);
      state.prevBuffer = buf;

      config.profiler?.endFrame(frame);
    } catch (error) {
      config.handleError(createErrorContext("render", error));
    }
  }

  /**
   * Gets the current render loop state
   */
  function getState(): RenderLoopState {
    return state;
  }

  return {
    render,
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
