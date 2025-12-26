import { describe, it, expect } from "bun:test";
import { createRenderer } from "@/runtime/render-loop";
import { Block, Text } from "@/view/primitives";
import { FlatBuffer } from "@/renderer";
import { setDirtyVersions } from "@/view/dirty";
import { ref } from "@/reactivity";
import type { Buffer2D } from "@/types";

const mockLayoutResult = { root: { x: 0, y: 0, width: 80, height: 24 } };

const mockBufferA: Buffer2D = new FlatBuffer(24, 80);
const mockBufferB: Buffer2D = new FlatBuffer(24, 80);
let acquireCount = 0;

const mockPool = {
  acquire: () => {
    acquireCount++;
    return acquireCount % 2 === 1 ? mockBufferA : mockBufferB;
  },
  release: () => {},
};

describe("createRenderer", () => {
  it("should create a renderer and perform a render cycle", () => {
    acquireCount = 0;
    let size = { rows: 24, cols: 80 };
    const renderer = createRenderer({
      getSize: () => size,
      write: () => {},
      view: () => Block(),
      getState: () => ({}),
      handleError: (e) => console.error(e),
      deps: {
        FlatBuffer,
        getGlobalBufferPool: () => mockPool,
        renderDiff: () => "x",
        layout: () => mockLayoutResult,
        renderElement: () => {},
      },
    });

    // Initial state
    let state = renderer.getState();
    expect(state.currentSize).toEqual({ rows: 24, cols: 80 });

    // Render once
    renderer.renderOnce();
    state = renderer.getState();
    expect(state.prevBuffer === mockBufferA || state.prevBuffer === mockBufferB).toBe(true);

    // Change size and re-render
    size = { rows: 30, cols: 100 };
    renderer.renderOnce(true); // force redraw
    state = renderer.getState();
    expect(state.currentSize).toEqual({ rows: 30, cols: 100 });
    renderer.dispose();
  });

  it("should skip a whole frame when nothing changed (immediate-mode view)", () => {
    setDirtyVersions({ layout: 0, render: 0 });

    let layoutCalls = 0;
    let diffCalls = 0;

    const renderer = createRenderer({
      getSize: () => ({ rows: 24, cols: 80 }),
      write: () => {},
      view: () => Block(),
      getState: () => ({}),
      handleError: (e) => console.error(e),
      deps: {
        FlatBuffer,
        getGlobalBufferPool: () => mockPool,
        renderDiff: () => {
          diffCalls++;
          return "x";
        },
        layout: () => {
          layoutCalls++;
          return mockLayoutResult;
        },
        renderElement: () => {},
      },
    });

    renderer.renderOnce();
    renderer.renderOnce();

    expect(layoutCalls).toBe(1);
    expect(diffCalls).toBe(1);
    renderer.dispose();
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
      deps: {
        FlatBuffer,
        getGlobalBufferPool: () => mockPool,
        renderDiff: () => "x",
        layout: () => mockLayoutResult,
        renderElement: () => {},
      },
    });

    renderer.renderOnce();

    expect(errorCaught).not.toBeNull();
    expect(errorCaught!).toBe(testError);
    renderer.dispose();
  });

  it("should coalesce multiple reactive triggers into one render", async () => {
    setDirtyVersions({ layout: 0, render: 0 });

    const counter = ref(0);
    let diffCalls = 0;

    const renderer = createRenderer({
      getSize: () => ({ rows: 24, cols: 80 }),
      write: () => {},
      view: () => {
        return Block(Text(String(counter.value)));
      },
      getState: () => ({}),
      handleError: (e) => console.error(e),
      deps: {
        FlatBuffer,
        getGlobalBufferPool: () => mockPool,
        renderDiff: () => {
          diffCalls++;
          return "x";
        },
        layout: () => mockLayoutResult,
        renderElement: () => {},
      },
    });

    renderer.render();
    expect(diffCalls).toBe(1);

    counter.value++;
    counter.value++;
    counter.value++;

    await new Promise<void>((resolve) => queueMicrotask(resolve));

    // Coalesced: one additional render for the 3 mutations.
    expect(diffCalls).toBe(2);
    renderer.dispose();
  });
});
