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

  it("requestRender should update reactive dependency tracking (non-reactive invalidation)", async () => {
    setDirtyVersions({ layout: 0, render: 0 });

    const a = ref(0);
    const b = ref(0);
    let mode = 0; // Non-reactive: simulates resize/layout-driven branching.
    let diffCalls = 0;

    const renderer = createRenderer({
      getSize: () => ({ rows: 24, cols: 80 }),
      write: () => {},
      view: () => {
        return Block(Text(mode === 0 ? `b=${b.value}` : `a=${a.value}`));
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

    // Change non-reactive branch selector; must explicitly invalidate to re-track deps.
    mode = 1;
    renderer.requestRender();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(diffCalls).toBe(2);

    // After requestRender, `a` should now be tracked and trigger a render.
    a.value++;
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(diffCalls).toBe(3);

    renderer.dispose();
  });

  it("should use dirty-rect rendering when only render props change", () => {
    setDirtyVersions({ layout: 0, render: 0 });

    let value = "a";
    const clips: Array<{ x: number; y: number; width: number; height: number }> = [];

    const renderer = createRenderer({
      getSize: () => ({ rows: 24, cols: 80 }),
      write: () => {},
      view: () => {
        const child = Text(value).setKey("root/text");
        return Block(child).setKey("root");
      },
      getState: () => ({}),
      handleError: (e) => console.error(e),
      deps: {
        FlatBuffer,
        getGlobalBufferPool: () => mockPool,
        renderDiff: () => "x",
        layout: () => ({
          root: { x: 0, y: 0, width: 80, height: 24 },
          "root/text": { x: 0, y: 1, width: 10, height: 1 },
        }),
        renderElement: (_el, _buf, _layout, _px, _py, clipRect) => {
          clips.push(clipRect ?? { x: 0, y: 0, width: 80, height: 24 });
        },
      },
    });

    renderer.renderOnce();

    // 2nd render: collects maps but still does a full render (no previous sigs yet).
    value = "b";
    renderer.renderOnce();

    // 3rd render: should use dirty-rect path and pass a clipped rect.
    value = "c";
    renderer.renderOnce();

    const last = clips.at(-1);
    expect(last).toEqual({ x: 0, y: 1, width: 10, height: 1 });
    renderer.dispose();
  });
});
