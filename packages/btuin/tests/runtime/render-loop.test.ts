import { describe, it, expect, mock } from "bun:test";
import { createRenderer } from "../../src/runtime/render-loop";
import { Block } from "../../src/view/primitives";
import { FlatBuffer, type Buffer2D } from "@btuin/renderer";

// Mocks
const mockLayoutResult = { root: { x: 0, y: 0, width: 80, height: 24 } };
mock.module("../../../src/layout", () => ({
  layout: () => mockLayoutResult,
  renderElement: () => {},
}));

const mockBuffer: Buffer2D = new FlatBuffer(24, 80);

const mockPool = {
  acquire: () => mockBuffer,
  release: () => {},
};
mock.module("@btuin/renderer", () => ({
  getGlobalBufferPool: () => mockPool,
  renderDiff: () => "",
}));

describe("createRenderer", () => {
  it("should create a renderer and perform a render cycle", () => {
    let size = { rows: 24, cols: 80 };
    const renderer = createRenderer({
      getSize: () => size,
      write: () => {},
      view: () => Block(),
      getState: () => ({}),
      handleError: (e) => console.error(e),
    });

    // Initial state
    let state = renderer.getState();
    expect(state.currentSize).toEqual({ rows: 24, cols: 80 });

    // Render once
    renderer.render();
    state = renderer.getState();
    expect(state.prevBuffer).toBe(mockBuffer);

    // Change size and re-render
    size = { rows: 30, cols: 100 };
    renderer.render(true); // force redraw
    state = renderer.getState();
    expect(state.currentSize).toEqual({ rows: 30, cols: 100 });
  });

  it("should call the error handler on render error", () => {
    let errorCaught: Error | null = null;
    const testError = new Error("Render failed");

    const renderer = createRenderer({
      getSize: () => ({ rows: 24, cols: 80 }),
      write: () => {},
      view: () => {
        throw testError;
      },
      getState: () => ({}),
      handleError: (ctx) => {
        errorCaught = ctx.error as Error;
      },
    });

    renderer.render();

    expect(errorCaught).not.toBeNull();
    expect(errorCaught!).toBe(testError);
  });
});
