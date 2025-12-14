import {
  initLayoutEngine as initWasm,
  computeLayout,
  type LayoutInputNode,
  type ComputedLayout,
} from "@btuin/layout-engine";
import { isBlock, isText, type ViewElement } from "../view/types/elements";

export { renderElement } from "./renderer";

export async function initLayoutEngine() {
  await initWasm();
}

export interface LayoutContainerSize {
  width: number;
  height: number;
}

function ensureKeys(element: ViewElement, prefix: string) {
  if (!element.key) {
    element.key = prefix;
  }

  if (isBlock(element)) {
    for (let i = 0; i < element.children.length; i++) {
      const child = element.children[i]!;
      ensureKeys(child, `${element.key}/${child.type}-${i}`);
    }
  }
}

function viewElementToLayoutNode(element: ViewElement): LayoutInputNode {
  const { key, style } = element;

  const node: LayoutInputNode = {
    key,
    type: element.type,
    ...style,
  };

  if (isBlock(element)) {
    node.children = element.children.map(viewElementToLayoutNode);
  } else if (isText(element)) {
    const textWidth = element.content.length;
    node.measuredSize = { width: textWidth, height: 1 };
    if (node.width === undefined) node.width = textWidth;
    if (node.height === undefined) node.height = 1;
  }

  return node;
}

function resolveRootSize(root: ViewElement, containerSize?: LayoutContainerSize) {
  if (!containerSize) return;
  const style = (root.style ??= {});

  if (style.width === undefined || style.width === "100%") {
    style.width = containerSize.width;
  }
  if (style.height === undefined || style.height === "100%") {
    style.height = containerSize.height;
  }
}

export function layout(root: ViewElement, containerSize?: LayoutContainerSize): ComputedLayout {
  ensureKeys(root, "root");
  resolveRootSize(root, containerSize);

  const layoutNode = viewElementToLayoutNode(root);
  return computeLayout(layoutNode);
}
