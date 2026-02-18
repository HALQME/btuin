import { dlopen, FFIType, suffix, ptr, toArrayBuffer } from "bun:ffi";
import path from "node:path";
import type { LayoutInputNode, ComputedLayout, Dimension, LayoutStyle } from "./types";
import { existsSync } from "node:fs";

// --- Constants (must match Zig layout-engine) ---
const STYLE_STRIDE = 32;
const RESULT_STRIDE = 5;

// StyleProp indices (must match StyleProp enum in Zig)
const StyleProp = {
  Display: 0,
  PositionType: 1,
  FlexDirection: 2,
  JustifyContent: 3,
  AlignItems: 4,
  AlignSelf: 5,
  FlexGrow: 6,
  FlexShrink: 7,
  Width: 8,
  Height: 9,
  MinWidth: 10,
  MinHeight: 11,
  MaxWidth: 12,
  MaxHeight: 13,
  GapRow: 14,
  GapColumn: 15,
  PaddingTop: 16,
  PaddingRight: 17,
  PaddingBottom: 18,
  PaddingLeft: 19,
  MarginTop: 20,
  MarginRight: 21,
  MarginBottom: 22,
  MarginLeft: 23,
  ChildrenCount: 24,
  ChildrenOffset: 25,
} as const;

// --- Helper Functions ---

function dimToFloat(dim: Dimension | undefined): number {
  if (typeof dim === "number") {
    // Negative values represent percentages in the new API
    // e.g., -0.5 means 50%
    return dim;
  }
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

// --- Serialization ---

function serializeTree(root: LayoutInputNode): {
  nodesBuffer: Float32Array;
  childrenBuffer: Uint32Array;
  nodeCount: number;
} {
  const flatNodes: LayoutInputNode[] = [];
  const nodeMap = new Map<LayoutInputNode, number>();

  function traverse(node: LayoutInputNode, idCounter = { count: 0 }) {
    if (nodeMap.has(node)) return;
    const id = idCounter.count++;
    nodeMap.set(node, id);
    flatNodes[id] = node;
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

    // Basic display properties
    nodesBuffer[offset + StyleProp.Display] = 0; // Flex
    nodesBuffer[offset + StyleProp.PositionType] = style.position === "absolute" ? 1 : 0;

    // Flex direction
    const flexDirectionMap: Record<string, number> = {
      row: 0,
      column: 1,
      "row-reverse": 2,
      "column-reverse": 3,
    };
    nodesBuffer[offset + StyleProp.FlexDirection] =
      flexDirectionMap[style.flexDirection ?? "row"] ?? 0;

    // Justify content
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

    // Align items
    const alignItemsMap: Record<string, number> = {
      stretch: 0,
      "flex-start": 1,
      "flex-end": 2,
      center: 3,
    };
    nodesBuffer[offset + StyleProp.AlignItems] = alignItemsMap[style.alignItems ?? "stretch"] ?? 0;

    // Align self
    const alignSelfMap: Record<string, number> = {
      auto: 0,
      "flex-start": 1,
      "flex-end": 2,
      center: 3,
      stretch: 4,
    };
    nodesBuffer[offset + StyleProp.AlignSelf] = alignSelfMap[style.alignSelf ?? "auto"] ?? 0;

    // Flex properties
    nodesBuffer[offset + StyleProp.FlexGrow] = style.flexGrow ?? 0;
    nodesBuffer[offset + StyleProp.FlexShrink] = style.flexShrink ?? 1;

    // Dimensions (width, height)
    nodesBuffer[offset + StyleProp.Width] = dimToFloat(style.width);
    nodesBuffer[offset + StyleProp.Height] = dimToFloat(style.height);
    nodesBuffer[offset + StyleProp.MinWidth] = dimToFloat(style.minWidth);
    nodesBuffer[offset + StyleProp.MinHeight] = dimToFloat(style.minHeight);
    nodesBuffer[offset + StyleProp.MaxWidth] = dimToFloat(style.maxWidth);
    nodesBuffer[offset + StyleProp.MaxHeight] = dimToFloat(style.maxHeight);

    // Gap
    const [gapRow, gapColumn] = gapToPair(style.gap);
    nodesBuffer[offset + StyleProp.GapRow] = gapRow;
    nodesBuffer[offset + StyleProp.GapColumn] = gapColumn;

    // Padding (top, right, bottom, left)
    const paddingArr = boxToQuad(style.padding);
    nodesBuffer[offset + StyleProp.PaddingTop] = paddingArr[0];
    nodesBuffer[offset + StyleProp.PaddingRight] = paddingArr[1];
    nodesBuffer[offset + StyleProp.PaddingBottom] = paddingArr[2];
    nodesBuffer[offset + StyleProp.PaddingLeft] = paddingArr[3];

    // Margin (top, right, bottom, left)
    const marginArr = boxToQuad(style.margin);
    nodesBuffer[offset + StyleProp.MarginTop] = marginArr[0];
    nodesBuffer[offset + StyleProp.MarginRight] = marginArr[1];
    nodesBuffer[offset + StyleProp.MarginBottom] = marginArr[2];
    nodesBuffer[offset + StyleProp.MarginLeft] = marginArr[3];

    // Children
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
  return { nodesBuffer, childrenBuffer, nodeCount };
}

// --- FFI Setup ---

const libName = "liblayout-engine";
const libPath = () => {
  // Try development path first
  let devpath = path.join(import.meta.dir, "target", "release", `${libName}.${suffix}`);
  if (existsSync(devpath)) {
    return devpath;
  }
  
  // Try root level (for built packages)
  let rootPath = path.join(import.meta.dir, "..", "..", "..", `${libName}.${suffix}`);
  if (existsSync(rootPath)) {
    return rootPath;
  }

  // Try platform-specific binary
  const platform = process.platform;
  const arch = process.arch;
  const binName = `${libName}-${platform}-${arch}.${suffix}`;
  const nativePath = path.join(import.meta.dir, "native", binName);

  if (!existsSync(nativePath))
    throw new Error(
      `[btuin] Native binary not found. ` +
      `Tried: ${devpath}, ${rootPath}, ${nativePath}\n` +
      `Please run: build-ffi`
    );

  return nativePath;
};

const { symbols } = dlopen(libPath(), {
  // Engine lifecycle
  le_create: { args: [], returns: FFIType.ptr },
  le_destroy: { args: [FFIType.ptr], returns: FFIType.void },
  le_version: { args: [], returns: FFIType.u32 },
  
  // Layout computation
  le_compute: {
    args: [
      FFIType.ptr,      // engine
      FFIType.ptr,      // style_buffer
      FFIType.u64,      // style_buffer_len
      FFIType.ptr,      // children_buffer
      FFIType.u64,      // children_buffer_len
      FFIType.u32,      // node_count
      FFIType.f32,      // available_width
      FFIType.f32,      // available_height
    ],
    returns: FFIType.i32,
  },
  
  // Results access
  le_get_results_ptr: { args: [FFIType.ptr], returns: FFIType.ptr },
  le_get_results_len: { args: [FFIType.ptr], returns: FFIType.u64 },
  
  // Introspection
  le_abi_version: { args: [], returns: FFIType.u32 },
  le_style_stride: { args: [], returns: FFIType.u32 },
  le_result_stride: { args: [], returns: FFIType.u32 },
});

// Verify ABI version
const abiVersion = symbols.le_abi_version();
if (abiVersion !== 3) {
  console.warn(
    `[btuin] Layout engine ABI version mismatch. ` +
    `Expected: 3, Got: ${abiVersion}`
  );
}

// --- Layout Engine Class ---

class LayoutEngineJS {
  private enginePtr: import("bun:ffi").Pointer | null;

  constructor() {
    this.enginePtr = symbols.le_create();
    if (!this.enginePtr) throw new Error("Failed to create layout engine.");
  }

  compute(root: LayoutInputNode, availableWidth = Infinity, availableHeight = Infinity): ComputedLayout {
    if (!this.enginePtr) throw new Error("Layout engine has been destroyed.");
    
    const { nodesBuffer, childrenBuffer, nodeCount } = serializeTree(root);

    const status = symbols.le_compute(
      this.enginePtr,
      nodesBuffer.length > 0 ? ptr(nodesBuffer) : null,
      nodesBuffer.length,
      childrenBuffer.length > 0 ? ptr(childrenBuffer) : null,
      childrenBuffer.length,
      nodeCount,
      Number.isFinite(availableWidth) ? availableWidth : 1e38,
      Number.isFinite(availableHeight) ? availableHeight : 1e38,
    );

    if (status !== 0) {
      throw new Error(`Layout computation failed with status: ${status}`);
    }

    return this.readResults();
  }

  private readResults(): ComputedLayout {
    const resultsPtr = symbols.le_get_results_ptr(this.enginePtr);
    const resultsLen = Number(symbols.le_get_results_len(this.enginePtr));

    if (!resultsPtr || resultsLen === 0) return {};

    const resultsBuffer = new Float32Array(
      toArrayBuffer(resultsPtr, 0, resultsLen * Float32Array.BYTES_PER_ELEMENT)
    );

    const computedLayout: ComputedLayout = {};
    const snap = (value: number): number => {
      if (!Number.isFinite(value)) return value;
      const rounded = Math.round(value);
      return Math.abs(value - rounded) < 1e-4 ? rounded : value;
    };

    for (let i = 0; i < resultsLen; i += RESULT_STRIDE) {
      const nodeId = resultsBuffer[i]!;
      // Node ID corresponds to traversal order, we need to map it back
      // For now, use the node ID as the key directly
      computedLayout[nodeId] = {
        x: snap(resultsBuffer[i + 1]!),
        y: snap(resultsBuffer[i + 2]!),
        width: snap(resultsBuffer[i + 3]!),
        height: snap(resultsBuffer[i + 4]!),
      };
    }

    return computedLayout;
  }

  destroy() {
    if (this.enginePtr) {
      symbols.le_destroy(this.enginePtr);
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

export function computeLayout(
  root: LayoutInputNode,
  availableWidth?: number,
  availableHeight?: number
): ComputedLayout {
  return getEngine().compute(root, availableWidth, availableHeight);
}

export function cleanupLayoutEngine() {
  if (engineInstance) {
    engineInstance.destroy();
    engineInstance = null;
  }
}

// Export constants for introspection
export { STYLE_STRIDE, RESULT_STRIDE };
