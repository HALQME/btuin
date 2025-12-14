/**
 * Render Loop Module
 *
 * Handles the rendering loop, including buffer management and diff rendering.
 */

import { getGlobalBufferPool, renderDiff, type Buffer2D } from "@btuin/renderer";
import { layout, renderElement } from "../layout";
import type { ViewElement } from "../view/types/elements";
import type { Rect } from "@btuin/layout-engine";
import { createErrorContext } from "./error-boundary";

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
  /** Function to generate view from state */
  view: (state: State) => ViewElement;
  /** Function to get current state */
  getState: () => State;
  /** Error handler */
  handleError: (context: import("./error-boundary").ErrorContext) => void;
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

      const buf = pool.acquire();
      const rootElement = config.view(config.getState());

      const layoutResult = layout(rootElement)

      renderElement(rootElement, buf, layoutResult, 0, 0)
      renderDiff(state.prevBuffer, buf);

      // Return old prev buffer to the pool and keep the new one
      pool.release(state.prevBuffer);
      state.prevBuffer = buf;
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
