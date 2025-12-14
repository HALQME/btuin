import {
  initLayoutEngine as initWasm,
  computeLayout,
  type LayoutInputNode,
  type ComputedLayout,
} from "@btuin/layout-engine";
import type { ViewElement } from "../view/types/elements";

export { renderElement } from "./renderer";

export async function initLayoutEngine() {
  await initWasm();
}

export function layout(root: ViewElement): ComputedLayout {
  if (!root.key) {
    root.key = "root";
  }

  return computeLayout(root as LayoutInputNode);
}
