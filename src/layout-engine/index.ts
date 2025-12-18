import type { LayoutElementShape, ComputedLayout } from "./types";
import init, {
  compute_layout,
  init_layout_engine as wasm_init_layout_engine,
  remove_nodes,
  update_nodes,
} from "./pkg/layout_engine.js";
import wasm from "./pkg/layout_engine_bg.wasm";
void wasm;

export * from "./types";

let wasmInitialized = false;

const layoutState = createLayoutState();

export async function initLayoutEngine() {
  if (!wasmInitialized) {
    await init();
    wasmInitialized = true;
  }
  wasm_init_layout_engine();
  layoutState.reset();
}

// ----------------------------------------------------------------------------
// Type Definitions
// ----------------------------------------------------------------------------

export type Dimension = number | string | "auto";

export interface LayoutStyle {
  display?: "flex" | "none";
  position?: "relative" | "absolute";

  width?: Dimension;
  height?: Dimension;
  minWidth?: Dimension;
  minHeight?: Dimension;
  maxWidth?: Dimension;
  maxHeight?: Dimension;
  layoutBoundary?: boolean;

  padding?: number | [number, number, number, number];
  margin?: number | [number, number, number, number];

  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
  flexWrap?: "nowrap" | "wrap" | "wrap-reverse";
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: Dimension;

  justifyContent?:
    | "flex-start"
    | "flex-end"
    | "center"
    | "space-between"
    | "space-around"
    | "space-evenly";
  alignItems?: "flex-start" | "flex-end" | "center" | "baseline" | "stretch";
  alignSelf?: "auto" | "flex-start" | "flex-end" | "center" | "baseline" | "stretch";

  gap?: number | { width?: number; height?: number };
}

export interface LayoutInputNode extends LayoutElementShape, LayoutStyle {
  /**
   * Back-compat alias for `identifier`.
   * Some callers/tests use `key` as the stable node id.
   */
  key?: string;
  identifier?: string;
  type: string;
  measuredSize?: { width: number; height: number };
  children?: LayoutInputNode[];
}

interface BridgeStyle {
  display?: string;
  position?: string;
  width?: Dimension;
  height?: Dimension;
  min_width?: Dimension;
  min_height?: Dimension;
  max_width?: Dimension;
  max_height?: Dimension;
  padding?: number[];
  margin?: number[];
  flex_direction?: string;
  flex_wrap?: string;
  flex_grow?: number;
  flex_shrink?: number;
  flex_basis?: Dimension;
  justify_content?: string;
  align_items?: string;
  align_self?: string;
  gap?: { width: number; height: number };
}

// ----------------------------------------------------------------------------
// Implementation
// ----------------------------------------------------------------------------

export function computeLayout(root: LayoutInputNode): ComputedLayout {
  if (!wasmInitialized) {
    throw new Error("Layout engine not initialized. Call initLayoutEngine() first.");
  }
  try {
    return layoutState.compute(root);
  } catch (cause) {
    if (cause instanceof Error && /not initialized/i.test(cause.message)) {
      throw cause;
    }
    throw new Error("failed to compute layout", { cause });
  }
}

interface BridgeNodePayload {
  key: string;
  style: BridgeStyle;
  children: string[];
  measure?: { width: number; height: number };
}

function createLayoutState() {
  let signatures = new Map<string, string>();

  function reset() {
    signatures = new Map();
  }

  function compute(root: LayoutInputNode): ComputedLayout {
    const nodes: BridgeNodePayload[] = [];
    flattenBridgeNodes(root, nodes);

    if (nodes.length === 0 || !nodes[0]) {
      throw new Error("Layout tree must contain at least one node.");
    }

    const newSignatures = new Map<string, string>();
    const currentKeys = new Set<string>();
    const changedNodes: BridgeNodePayload[] = [];

    for (const node of nodes) {
      const signature = createSignature(node);
      newSignatures.set(node.key, signature);
      currentKeys.add(node.key);
      if (signatures.get(node.key) !== signature) {
        changedNodes.push(node);
      }
    }

    const removedKeys = [...signatures.keys()].filter((key) => !currentKeys.has(key));
    signatures = newSignatures;

    if (removedKeys.length > 0) {
      remove_nodes(removedKeys);
    }

    if (changedNodes.length > 0) {
      update_nodes(changedNodes);
    }

    const rootKey = nodes[0].key;
    const result = compute_layout(rootKey);
    return normalizeComputedLayout(result);
  }

  return {
    reset,
    compute,
  };
}

function normalizeComputedLayout(value: unknown): ComputedLayout {
  if (!value) return {};
  const maybeMap = value as { entries?: unknown; get?: unknown };
  const isMapLike =
    value instanceof Map ||
    (typeof maybeMap === "object" &&
      maybeMap !== null &&
      typeof maybeMap.entries === "function" &&
      typeof maybeMap.get === "function");

  if (isMapLike) {
    const out: ComputedLayout = {};
    for (const [key, rect] of (value as Map<unknown, unknown>).entries()) {
      if (typeof key === "string") {
        out[key] = rect as ComputedLayout[string];
      }
    }
    return out;
  }
  return value as ComputedLayout;
}

function flattenBridgeNodes(node: LayoutInputNode, nodes: BridgeNodePayload[]): string {
  const key = node.key ?? node.identifier ?? `node-${nodes.length}`;
  const index = nodes.length;
  nodes.push({
    key,
    style: extractStyle(node),
    children: [],
    measure: node.measuredSize,
  });

  if (node.children && node.children.length > 0) {
    const childKeys = node.children.map((child) => flattenBridgeNodes(child, nodes));
    nodes[index]!.children = childKeys;
  }

  return key;
}

function createSignature(node: BridgeNodePayload): string {
  const styleJson = JSON.stringify(node.style);
  const childrenKey = node.children.join(",");
  const measureKey = node.measure ? `${node.measure.width}:${node.measure.height}` : "";
  return `${styleJson}|${childrenKey}|${measureKey}`;
}

function extractStyle(node: LayoutInputNode): BridgeStyle {
  const s: BridgeStyle = {};

  if (node.width !== undefined) s.width = node.width;
  if (node.height !== undefined) s.height = node.height;
  if (node.minWidth !== undefined) s.min_width = node.minWidth;
  if (node.minHeight !== undefined) s.min_height = node.minHeight;
  if (node.maxWidth !== undefined) s.max_width = node.maxWidth;
  if (node.maxHeight !== undefined) s.max_height = node.maxHeight;

  if (node.display) s.display = node.display;
  if (node.position) s.position = node.position;

  if (node.padding !== undefined) {
    s.padding = Array.isArray(node.padding)
      ? node.padding
      : [node.padding, node.padding, node.padding, node.padding];
  }
  if (node.margin !== undefined) {
    s.margin = Array.isArray(node.margin)
      ? node.margin
      : [node.margin, node.margin, node.margin, node.margin];
  }

  if (node.flexDirection) s.flex_direction = node.flexDirection;
  if (node.flexWrap) s.flex_wrap = node.flexWrap;
  if (node.flexGrow !== undefined) s.flex_grow = node.flexGrow;
  if (node.flexShrink !== undefined) s.flex_shrink = node.flexShrink;
  if (node.flexBasis !== undefined) s.flex_basis = node.flexBasis;

  if (node.justifyContent) s.justify_content = node.justifyContent;
  if (node.alignItems) s.align_items = node.alignItems;
  if (node.alignSelf) s.align_self = node.alignSelf;

  if (node.gap !== undefined) {
    s.gap =
      typeof node.gap === "number"
        ? { width: node.gap, height: node.gap }
        : { width: node.gap.width ?? 0, height: node.gap.height ?? 0 };
  }

  return s;
}
