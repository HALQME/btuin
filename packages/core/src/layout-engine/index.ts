import { dlopen, FFIType, suffix, ptr, toArrayBuffer } from "bun:ffi";
import path from "node:path";
import type { LayoutInputNode, ComputedLayout, Dimension, LayoutStyle } from "./types";
import { existsSync } from "node:fs";

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

// --- Incremental FFI ops (must match Rust) ---
enum LayoutOp {
  CreateLeaf = 1,
  UpdateStyle = 2,
  SetChildren = 3,
  RemoveNode = 4,
}

// --- Helper Functions for Serialization ---

function dimToFloat(dim: Dimension | undefined): number {
  if (typeof dim === "number") return dim;
  return NaN; // Represents 'auto'
}

function gapToPair(gap: LayoutStyle["gap"] | undefined): [number, number] {
  if (typeof gap === "number") return [gap, gap];
  if (gap && typeof gap === "object") return [gap.height ?? 0, gap.width ?? 0];
  return [0, 0];
}

function boxToQuad(
  value: LayoutStyle["margin"] | LayoutStyle["padding"] | undefined,
): [number, number, number, number] {
  if (typeof value === "number") return [value, value, value, value];
  if (Array.isArray(value) && value.length === 4) return value as [number, number, number, number];
  return [0, 0, 0, 0];
}

function writeStyle(out: Float32Array, node: LayoutInputNode) {
  out.fill(0);
  const style: LayoutStyle = node;

  out[StyleProp.FlexGrow] = style.flexGrow ?? 0;
  out[StyleProp.FlexShrink] = style.flexShrink ?? 1;

  const flexDirectionMap: Record<string, number> = {
    row: 0,
    column: 1,
    "row-reverse": 2,
    "column-reverse": 3,
  };
  out[StyleProp.FlexDirection] = flexDirectionMap[style.flexDirection ?? "row"] ?? 0;

  const [gapRow, gapColumn] = gapToPair(style.gap);
  out[StyleProp.GapRow] = gapRow;
  out[StyleProp.GapColumn] = gapColumn;

  const justifyContentMap: Record<string, number> = {
    "flex-start": 0,
    "flex-end": 1,
    center: 2,
    "space-between": 3,
    "space-around": 4,
    "space-evenly": 5,
  };
  out[StyleProp.JustifyContent] = justifyContentMap[style.justifyContent ?? "flex-start"] ?? 0;

  const alignItemsMap: Record<string, number> = {
    "flex-start": 0,
    "flex-end": 1,
    center: 2,
    baseline: 3,
    stretch: 4,
  };
  out[StyleProp.AlignItems] = alignItemsMap[style.alignItems ?? "stretch"] ?? 4;

  const positionTypeMap: Record<string, number> = {
    relative: 0,
    absolute: 1,
  };
  out[StyleProp.PositionType] = positionTypeMap[style.position ?? "relative"] ?? 0;

  out[StyleProp.Width] = dimToFloat(style.width);
  out[StyleProp.Height] = dimToFloat(style.height);

  const marginArr = boxToQuad(style.margin);
  out.set(marginArr, StyleProp.MarginLeft);

  const paddingArr = boxToQuad(style.padding);
  out.set(paddingArr, StyleProp.PaddingLeft);
}

function sameFloat(a: number, b: number): boolean {
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}

function sameStyle(a: Float32Array, b: Float32Array): boolean {
  for (let i = 0; i < STYLE_STRIDE; i++) {
    if (!sameFloat(a[i]!, b[i]!)) return false;
  }
  return true;
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

    const [gapRow, gapColumn] = gapToPair(style.gap);
    nodesBuffer[offset + StyleProp.GapRow] = gapRow;
    nodesBuffer[offset + StyleProp.GapColumn] = gapColumn;

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

    const marginArr = boxToQuad(style.margin);
    nodesBuffer.set(marginArr, offset + StyleProp.MarginLeft);

    const paddingArr = boxToQuad(style.padding);
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
const libPath = () => {
  let devpath = path.join(import.meta.dir, "target", "release", `${libName}.${suffix}`);
  if (existsSync(devpath)) {
    return devpath;
  }
  const platform = process.platform;
  const arch = process.arch;
  const binName = `liblayout_engine-${platform}-${arch}.${suffix}`;
  const libPath = path.join(import.meta.dir, "native", binName);

  if (!existsSync(libPath))
    throw new Error(`
        [btuin] Native binary not found at: ${libPath}
        Platform: ${platform}, Arch: ${arch}
        Please ensure the package is installed correctly.
      `);

  return libPath;
};

const { symbols } = dlopen(libPath(), {
  create_engine: { args: [], returns: FFIType.ptr },
  destroy_engine: { args: [FFIType.ptr], returns: FFIType.void },
  compute_layout_from_buffers: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.u64, FFIType.ptr, FFIType.u64],
    returns: FFIType.i32,
  },
  apply_ops_and_compute: {
    args: [
      FFIType.ptr,
      FFIType.ptr,
      FFIType.u64,
      FFIType.ptr,
      FFIType.u64,
      FFIType.ptr,
      FFIType.u64,
    ],
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
  private keyToId = new Map<string, number>();
  private idToKey = new Map<number, string>();
  private prevStyle = new Map<number, Float32Array>();
  private prevChildren = new Map<number, number[]>();
  private freeIds: number[] = [];
  private nextId = 1;

  constructor() {
    this.enginePtr = symbols.create_engine();
    if (!this.enginePtr) throw new Error("Failed to create layout engine.");
    registry.register(this, this.enginePtr, this);
  }

  compute(root: LayoutInputNode): ComputedLayout {
    if (!this.enginePtr) throw new Error("Layout engine has been destroyed.");
    if (process.env.BTUIN_DISABLE_FFI_DIRTY_CHECKING === "1") {
      return this.computeFull(root);
    }
    try {
      return this.computeDirty(root);
    } catch {
      this.resetDirtyCache();
      return this.computeFull(root);
    }
  }

  private resetDirtyCache() {
    this.keyToId.clear();
    this.idToKey.clear();
    this.prevStyle.clear();
    this.prevChildren.clear();
    this.freeIds.length = 0;
    this.nextId = 1;
  }

  private computeFull(root: LayoutInputNode): ComputedLayout {
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

    const computedLayout: ComputedLayout = {};
    this.readResultsToLayout(computedLayout, (id) => {
      const node = flatNodes[id];
      return node?.key ?? node?.identifier;
    });
    return computedLayout;
  }

  private computeDirty(root: LayoutInputNode): ComputedLayout {
    if (!this.enginePtr) throw new Error("Layout engine has been destroyed.");

    const rootKey = root.key ?? root.identifier;
    if (!rootKey) return this.computeFull(root);

    const prevRootKey = this.idToKey.get(0);
    if (prevRootKey && prevRootKey !== rootKey) {
      this.keyToId.delete(prevRootKey);
    }
    this.keyToId.set(rootKey, 0);
    this.idToKey.set(0, rootKey);

    const seen = new Set<number>();

    const ensureId = (key: string): number => {
      const existing = this.keyToId.get(key);
      if (existing !== undefined) return existing;
      const id = this.freeIds.pop() ?? this.nextId++;
      this.keyToId.set(key, id);
      this.idToKey.set(id, key);
      return id;
    };

    const styleScratch = new Float32Array(STYLE_STRIDE);
    const stylePayloads: Float32Array[] = [];
    const childrenPayloads: number[][] = [];
    const ops: number[] = [];
    let childrenCursor = 0;

    const pushStyle = (style: Float32Array): number => {
      const offset = stylePayloads.length * STYLE_STRIDE;
      stylePayloads.push(style);
      return offset;
    };
    const pushChildren = (children: number[]): { offset: number; count: number } => {
      const offset = childrenCursor;
      childrenPayloads.push(children);
      childrenCursor += children.length;
      return { offset, count: children.length };
    };

    const visit = (node: LayoutInputNode): number => {
      const key = node.key ?? node.identifier;
      if (!key) throw new Error("[btuin] LayoutInputNode must have key or identifier.");
      const id = ensureId(key);
      seen.add(id);

      writeStyle(styleScratch, node);
      const prev = this.prevStyle.get(id);
      if (!prev) {
        const stored = new Float32Array(STYLE_STRIDE);
        stored.set(styleScratch);
        this.prevStyle.set(id, stored);
        const styleOffset = pushStyle(stored);
        ops.push(LayoutOp.CreateLeaf, id, styleOffset);
      } else if (!sameStyle(prev, styleScratch)) {
        prev.set(styleScratch);
        const styleOffset = pushStyle(prev);
        ops.push(LayoutOp.UpdateStyle, id, styleOffset);
      }

      const childrenIds = (node.children ?? []).map(visit);
      const prevKids = this.prevChildren.get(id) ?? [];
      let sameKids = prevKids.length === childrenIds.length;
      if (sameKids) {
        for (let i = 0; i < childrenIds.length; i++) {
          if (prevKids[i] !== childrenIds[i]) {
            sameKids = false;
            break;
          }
        }
      }
      if (!sameKids) {
        const { offset, count } = pushChildren(childrenIds);
        ops.push(LayoutOp.SetChildren, id, offset, count);
        this.prevChildren.set(id, childrenIds);
      }
      return id;
    };

    visit(root);

    // removals (after parents are updated)
    for (const id of this.prevStyle.keys()) {
      if (id === 0) continue;
      if (seen.has(id)) continue;
      ops.push(LayoutOp.RemoveNode, id);
      this.prevStyle.delete(id);
      this.prevChildren.delete(id);
      const key = this.idToKey.get(id);
      if (key) this.keyToId.delete(key);
      this.idToKey.delete(id);
      this.freeIds.push(id);
    }

    if (ops.length === 0) {
      const computedLayout: ComputedLayout = {};
      this.readResultsToLayout(computedLayout, (id) => this.idToKey.get(id));
      return computedLayout;
    }

    const opsBuf = new Uint32Array(ops);
    const styles = new Float32Array(stylePayloads.length * STYLE_STRIDE);
    for (let i = 0; i < stylePayloads.length; i++) {
      styles.set(stylePayloads[i]!, i * STYLE_STRIDE);
    }

    const children = new Uint32Array(childrenCursor);
    {
      let offset = 0;
      for (const arr of childrenPayloads) {
        children.set(arr, offset);
        offset += arr.length;
      }
    }

    const status = symbols.apply_ops_and_compute(
      this.enginePtr,
      opsBuf.length > 0 ? ptr(opsBuf) : null,
      opsBuf.length,
      styles.length > 0 ? ptr(styles) : null,
      styles.length,
      children.length > 0 ? ptr(children) : null,
      children.length,
    );

    if (status !== 0) {
      this.resetDirtyCache();
      return this.computeFull(root);
    }

    const computedLayout: ComputedLayout = {};
    this.readResultsToLayout(computedLayout, (id) => this.idToKey.get(id));
    return computedLayout;
  }

  private readResultsToLayout(
    target: ComputedLayout,
    resolveKey: (id: number) => string | undefined,
  ) {
    const resultsPtr = symbols.get_results_ptr(this.enginePtr);
    const resultsLenU64 = symbols.get_results_len(this.enginePtr);
    const resultsLen = Number(resultsLenU64);
    if (!Number.isSafeInteger(resultsLen)) {
      throw new Error(`Unexpected results length (u64): ${resultsLenU64.toString()}`);
    }

    if (!resultsPtr || resultsLen === 0) return;

    const resultsArrayBuffer = toArrayBuffer(
      resultsPtr,
      0,
      resultsLen * Float32Array.BYTES_PER_ELEMENT,
    );
    const resultsBuffer = new Float32Array(resultsArrayBuffer);

    const resultStride = 5; // js_id, x, y, width, height

    const snap = (value: number): number => {
      if (!Number.isFinite(value)) return value;
      const rounded = Math.round(value);
      return Math.abs(value - rounded) < 1e-4 ? rounded : value;
    };

    for (let i = 0; i < resultsLen; i += resultStride) {
      const jsId = resultsBuffer[i]!;
      const key = resolveKey(jsId);
      if (!key) continue;
      target[key] = {
        x: snap(resultsBuffer[i + 1]!),
        y: snap(resultsBuffer[i + 2]!),
        width: snap(resultsBuffer[i + 3]!),
        height: snap(resultsBuffer[i + 4]!),
      };
    }
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
