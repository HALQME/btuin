import { dlopen, FFIType, suffix, ptr, toArrayBuffer } from "bun:ffi";
import path from "node:path";
import type { LayoutInputNode, ComputedLayout, Dimension, LayoutStyle } from "./types";

export * from "./types";

// --- Data Layout Constants (must match Rust) ---
// prettier-ignore
enum StyleProp {
  Display, PositionType, FlexDirection, FlexWrap,
  JustifyContent, AlignItems, AlignSelf,
  FlexGrow, FlexShrink, FlexBasis,
  Width, Height, MinWidth, MinHeight, MaxWidth, MaxHeight,
  MarginLeft, MarginRight, MarginTop, MarginBottom,
  PaddingLeft, PaddingRight, PaddingTop, PaddingBottom,
  GapRow, GapColumn,
  ChildrenCount, ChildrenOffset,
  TotalProps,
}
const STYLE_STRIDE = StyleProp.TotalProps;

// --- Helper Functions for Serialization ---

function dimToFloat(dim: Dimension | undefined): number {
  if (typeof dim === "number") return dim;
  return NaN; // Represents 'auto'
}

function serializeTree(root: LayoutInputNode): {
  flatNodes: LayoutInputNode[];
  nodesBuffer: Float32Array;
  childrenBuffer: Uint32Array;
} {
  const flatNodes: LayoutInputNode[] = [];
  const nodeMap = new Map<LayoutInputNode, number>();

  function traverse(node: LayoutInputNode, idCounter = { count: 0 }) {
    if (nodeMap.has(node)) return;
    const id = idCounter.count++;
    nodeMap.set(node, id);
    flatNodes[id] = node; // Ensure order by ID
    if (node.children) {
      for (const child of node.children) {
        traverse(child, idCounter);
      }
    }
  }
  traverse(root);

  const nodeCount = flatNodes.length;
  const nodesBuffer = new Float32Array(nodeCount * STYLE_STRIDE);
  const childrenBufferData: number[] = [];

  for (let i = 0; i < nodeCount; i++) {
    const node = flatNodes[i];
    if (!node) continue;
    const style: LayoutStyle = node;
    const offset = i * STYLE_STRIDE;

    nodesBuffer[offset + StyleProp.FlexGrow] = style.flexGrow ?? 0;
    nodesBuffer[offset + StyleProp.FlexShrink] = style.flexShrink ?? 1;

    const flexDirectionMap: Record<string, number> = {
      row: 0,
      column: 1,
      "row-reverse": 2,
      "column-reverse": 3,
    };
    nodesBuffer[offset + StyleProp.FlexDirection] =
      flexDirectionMap[style.flexDirection ?? "row"] ?? 0;

    const gap = style.gap ?? 0;
    const gapArr = Array.isArray(gap) ? gap : [gap, gap];
    nodesBuffer[offset + StyleProp.GapRow] = gapArr[0];
    nodesBuffer[offset + StyleProp.GapColumn] = gapArr[1];

    const justifyContentMap: Record<string, number> = {
      "flex-start": 0,
      "flex-end": 1,
      center: 2,
      "space-between": 3,
      "space-around": 4,
      "space-evenly": 5,
    };
    nodesBuffer[offset + StyleProp.JustifyContent] =
      justifyContentMap[style.justifyContent ?? "flex-start"] ?? 0;

    const alignItemsMap: Record<string, number> = {
      "flex-start": 0,
      "flex-end": 1,
      center: 2,
      baseline: 3,
      stretch: 4,
    };
    nodesBuffer[offset + StyleProp.AlignItems] = alignItemsMap[style.alignItems ?? "stretch"] ?? 4;

    const positionTypeMap: Record<string, number> = {
      relative: 0,
      absolute: 1,
    };
    nodesBuffer[offset + StyleProp.PositionType] =
      positionTypeMap[style.position ?? "relative"] ?? 0;

    nodesBuffer[offset + StyleProp.Width] = dimToFloat(style.width);
    nodesBuffer[offset + StyleProp.Height] = dimToFloat(style.height);

    const margin = style.margin ?? 0;
    const marginArr = Array.isArray(margin) ? margin : [margin, margin, margin, margin];
    nodesBuffer.set(marginArr, offset + StyleProp.MarginLeft);

    const padding = style.padding ?? 0;
    const paddingArr = Array.isArray(padding) ? padding : [padding, padding, padding, padding];
    nodesBuffer.set(paddingArr, offset + StyleProp.PaddingLeft);

    const children = node.children ?? [];
    nodesBuffer[offset + StyleProp.ChildrenOffset] = childrenBufferData.length;
    nodesBuffer[offset + StyleProp.ChildrenCount] = children.length;
    for (const child of children) {
      const childId = nodeMap.get(child);
      if (childId === undefined) throw new Error("Child node not found in map.");
      childrenBufferData.push(childId);
    }
  }

  const childrenBuffer = new Uint32Array(childrenBufferData);
  return { flatNodes, nodesBuffer, childrenBuffer };
}

// --- FFI setup ---

const libName = "liblayout_engine";
const libPath = path.join(import.meta.dir, "target", "release", `${libName}.${suffix}`);

const { symbols } = dlopen(libPath, {
  create_engine: { args: [], returns: FFIType.ptr },
  destroy_engine: { args: [FFIType.ptr], returns: FFIType.void },
  compute_layout_from_buffers: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.u64, FFIType.ptr, FFIType.u64],
    returns: FFIType.i32,
  },
  get_results_ptr: { args: [FFIType.ptr], returns: FFIType.ptr },
  get_results_len: { args: [FFIType.ptr], returns: FFIType.u64 },
});

// --- Memory Management ---

const registry = new FinalizationRegistry((enginePtr: import("bun:ffi").Pointer) => {
  console.log(`[FFI] Finalizing engine at ${enginePtr}`);
  symbols.destroy_engine(enginePtr);
});

// --- FFI Wrapper Class ---

class LayoutEngineJS {
  private enginePtr: import("bun:ffi").Pointer | null;

  constructor() {
    this.enginePtr = symbols.create_engine();
    if (!this.enginePtr) throw new Error("Failed to create layout engine.");
    registry.register(this, this.enginePtr, this);
  }

  compute(root: LayoutInputNode): ComputedLayout {
    if (!this.enginePtr) throw new Error("Layout engine has been destroyed.");
    const { flatNodes, nodesBuffer, childrenBuffer } = serializeTree(root);

    const status = symbols.compute_layout_from_buffers(
      this.enginePtr,
      nodesBuffer.length > 0 ? ptr(nodesBuffer) : null,
      nodesBuffer.length,
      childrenBuffer.length > 0 ? ptr(childrenBuffer) : null,
      childrenBuffer.length,
    );

    if (status !== 0) {
      throw new Error(`Layout computation failed with status: ${status}`);
    }

    const resultsPtr = symbols.get_results_ptr(this.enginePtr);
    const resultsLenU64 = symbols.get_results_len(this.enginePtr);
    const resultsLen = Number(resultsLenU64);
    if (!Number.isSafeInteger(resultsLen)) {
      throw new Error(`Unexpected results length (u64): ${resultsLenU64.toString()}`);
    }

    if (!resultsPtr || resultsLen === 0) return {};

    const resultsArrayBuffer = toArrayBuffer(
      resultsPtr,
      0,
      resultsLen * Float32Array.BYTES_PER_ELEMENT,
    );
    const resultsBuffer = new Float32Array(resultsArrayBuffer);

    const computedLayout: ComputedLayout = {};
    const resultStride = 5; // js_id, x, y, width, height

    const snap = (value: number): number => {
      if (!Number.isFinite(value)) return value;
      const rounded = Math.round(value);
      return Math.abs(value - rounded) < 1e-4 ? rounded : value;
    };

    for (let i = 0; i < resultsLen; i += resultStride) {
      const jsId = resultsBuffer[i]!;
      const node = flatNodes[jsId];
      if (!node) continue;

      const key = node.key ?? node.identifier;
      if (key) {
        computedLayout[key] = {
          x: snap(resultsBuffer[i + 1]!),
          y: snap(resultsBuffer[i + 2]!),
          width: snap(resultsBuffer[i + 3]!),
          height: snap(resultsBuffer[i + 4]!),
        };
      }
    }

    return computedLayout;
  }

  destroy() {
    if (this.enginePtr) {
      symbols.destroy_engine(this.enginePtr);
      registry.unregister(this);
      this.enginePtr = null;
    }
  }
}

// --- Public API ---

let engineInstance: LayoutEngineJS | null = null;

function getEngine(): LayoutEngineJS {
  if (!engineInstance) {
    engineInstance = new LayoutEngineJS();
  }
  return engineInstance;
}

export function computeLayout(root: LayoutInputNode): ComputedLayout {
  return getEngine().compute(root);
}

export function cleanupLayoutEngine() {
  if (engineInstance) {
    engineInstance.destroy();
    engineInstance = null;
  }
}
