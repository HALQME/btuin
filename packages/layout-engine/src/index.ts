import type { LayoutElementShape, ComputedLayout } from "./types";

export * from "./types";

let wasmInitialized = false;

type LayoutEngineWasmModule = {
  default: (module_or_path?: unknown) => Promise<unknown>;
  compute_layout: (nodes_js: unknown) => unknown;
};

let wasmModule: LayoutEngineWasmModule | null = null;
let wasmImportPromise: Promise<LayoutEngineWasmModule> | null = null;

async function loadWasmModule(): Promise<LayoutEngineWasmModule> {
  if (wasmModule) return wasmModule;
  if (wasmImportPromise) return wasmImportPromise;

  wasmImportPromise = (async () => {
    try {
      const specifier = new URL("../pkg/layout_engine.js", import.meta.url).href;
      const mod = (await import(specifier)) as LayoutEngineWasmModule;
      wasmModule = mod;
      return mod;
    } catch (cause) {
      wasmImportPromise = null;
      throw new Error(
        [
          "Failed to load @btuin/layout-engine WASM module.",
          "The generated files are missing.",
          "Run: pnpm --filter @btuin/layout-engine build",
        ].join(" "),
        { cause },
      );
    }
  })();

  return wasmImportPromise;
}

export async function initLayoutEngine() {
  if (wasmInitialized) return;
  const mod = await loadWasmModule();
  await mod.default();
  wasmInitialized = true;
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
  key?: string;
  type: string;
  measuredSize?: { width: number; height: number };
  children?: LayoutInputNode[];
}

interface BridgeNode {
  style: BridgeStyle;
  children: number[];
  measure?: { width: number; height: number };
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
  if (!wasmModule) {
    throw new Error("Layout engine module not loaded. Call initLayoutEngine() first.");
  }

  const nodes: BridgeNode[] = [];
  const elementMap = new Map<number, string>();

  flattenTree(root, nodes, elementMap);

  let rawResults: any[];
  try {
    rawResults = wasmModule.compute_layout(nodes) as any[];
  } catch (cause) {
    throw new Error("Layout computation failed.", { cause });
  }

  const computed: ComputedLayout = {};
  rawResults.forEach((res: any, index: number) => {
    const key = elementMap.get(index);
    if (key) {
      computed[key] = {
        x: res.x,
        y: res.y,
        width: res.width,
        height: res.height,
      };
    }
  });

  return computed;
}

function flattenTree(
  node: LayoutInputNode,
  nodes: BridgeNode[],
  elementMap: Map<number, string>,
): number {
  const index = nodes.length;

  const key = node.key ?? `node-${index}`;
  elementMap.set(index, key);

  const bridgeNode: BridgeNode = {
    style: extractStyle(node),
    children: [],
    measure: node.measuredSize,
  };
  nodes.push(bridgeNode);

  if (node.children && node.children.length > 0) {
    const childIndices = node.children.map((child) => flattenTree(child, nodes, elementMap));
    nodes[index]!.children = childIndices;
  }

  return index;
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
