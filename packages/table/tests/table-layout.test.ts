import { describe, it, expect } from "bun:test";
import { Table } from "../src";
import { layout, type ViewElement } from "@btuin/element-kit";

describe("table layout", () => {
  it("slices rows based on height", () => {
    const element = Table({
      rows: [["row-1"], ["row-2"], ["row-3"]],
      height: 2,
      width: 10,
    });
    const rect = { x: 0, y: 0, width: 10, height: 2 };
    const laidOut = layout(element, rect);
    const tableElement = laidOut as any;
    expect(isTableLayoutResult(laidOut)).toBe(true);
    if (isTableLayoutResult(laidOut)) {
      expect(tableElement.rowCells?.length).toBe(2);
    }
  });
});

function isTableLayoutResult(
  element: ViewElement,
): element is ViewElement & { rowCells?: ViewElement[][] } {
  return element.type === "table";
}
