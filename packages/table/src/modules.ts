import {
  defineElement,
  drawText,
  fillRect,
  type KeyEvent,
  type LayoutChildFn,
  type ViewElement,
} from "@btuin/element-kit";
import type { TableCellValue, TableElement, TableTextElement } from "./table";

export const createTableElement = defineElement<TableElement>("table", {
  layout(element, innerRect, { layoutChild }) {
    const columnCount = Math.max(
      element.headers?.length ?? 0,
      ...element.rows.map((row) => row.length),
    );

    if (columnCount === 0 || innerRect.width <= 0 || innerRect.height <= 0) {
      if (element.focusKey) setTableOffset(element.focusKey, 0);
      return { ...element, innerRect, headerCells: undefined, rowCells: [], scrollOffset: 0 };
    }

    const widths = resolveTableWidths(columnCount, innerRect.width, element.columnWidths);
    const columnPositions: number[] = [];
    let cursorX = innerRect.x;
    for (const width of widths) {
      columnPositions.push(cursorX);
      cursorX += width;
    }

    const hasHeader = Boolean(element.headers && element.headers.length > 0);
    const headerHeight = hasHeader ? 1 : 0;
    const visibleRows = Math.max(0, innerRect.height - headerHeight);
    const offsetKey = element.focusKey;
    const maxOffset = Math.max(0, element.rows.length - visibleRows);

    // Auto-scroll to selected row if selectedIndex is provided
    let offset = getTableOffset(offsetKey);
    if (typeof element.selectedIndex === "number" && element.selectedIndex >= 0) {
      const selected = element.selectedIndex;
      // Ensure selected row is visible
      if (selected < offset) {
        offset = selected;
      } else if (selected >= offset + visibleRows) {
        offset = Math.max(0, selected - visibleRows + 1);
      }
    }

    offset = Math.min(Math.max(0, offset), maxOffset);
    setTableOffset(offsetKey, offset);

    let currentY = innerRect.y;
    let headerCells: ViewElement[] | undefined;
    if (hasHeader) {
      headerCells = layoutTableRow(
        element.headers ?? [],
        columnPositions,
        widths,
        currentY,
        layoutChild,
        "header",
      );
      currentY += 1;
    }

    const visibleRowValues =
      visibleRows > 0 ? element.rows.slice(offset, offset + visibleRows) : [];
    const rowCells: ViewElement[][] = visibleRowValues.map((rowValues, visibleIndex) => {
      const actualRowIndex = offset + visibleIndex;
      const isSelected = element.selectedIndex === actualRowIndex;
      const cells = layoutTableRow(
        rowValues,
        columnPositions,
        widths,
        currentY,
        layoutChild,
        "body",
        isSelected,
      );
      currentY += 1;
      return cells;
    });

    return {
      ...element,
      innerRect,
      headerCells,
      rowCells,
      scrollOffset: offset,
    };
  },
  render(element, buf, options, helpers) {
    const rect = element.innerRect ?? element.rect;
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    fillRect(buf, rect.y, rect.x, rect.width, rect.height, " ");

    if (element.headerCells) {
      for (const cell of element.headerCells) {
        helpers.renderChild(cell);
      }
    }

    if (element.rowCells) {
      for (const row of element.rowCells) {
        for (const cell of row) {
          helpers.renderChild(cell);
        }
      }
    }
  },
  collectFocus(element, acc, { collectChild }) {
    if (element.headerCells) {
      for (const cell of element.headerCells) collectChild(cell);
    }
    if (element.rowCells) {
      for (const row of element.rowCells) {
        for (const cell of row) collectChild(cell);
      }
    }
  },
  handleKey(element, key) {
    return handleTableKey(element, key);
  },
});

const createTableTextElement = defineElement<TableTextElement>("table:text", {
  render(element, buf) {
    const rect = element.innerRect ?? element.rect;
    if (!rect) return;
    let style = element.variant === "header" ? "dodgerblue" : "gray";
    if (element.isSelected) {
      style = "magenta";
    }
    drawText(buf, rect.y, rect.x, pad(element.text, rect.width), { fg: style });
  },
});

function layoutTableRow(
  values: TableCellValue[],
  columnPositions: number[],
  widths: number[],
  rowY: number,
  layoutChild: LayoutChildFn,
  variant: "header" | "body",
  isSelected: boolean = false,
): ViewElement[] {
  const cells: ViewElement[] = [];
  for (let i = 0; i < widths.length; i++) {
    const width = widths[i] ?? 1;
    const x = columnPositions[i] ?? columnPositions[columnPositions.length - 1] ?? 0;
    const cellValue = values[i] ?? "";
    const cellElement = normalizeTableCell(cellValue, variant, isSelected);
    const cellRect = { x, y: rowY, width, height: 1 };
    cells.push(layoutChild(cellElement, cellRect));
  }
  return cells;
}

function normalizeTableCell(
  value: TableCellValue,
  variant: "header" | "body",
  isSelected: boolean = false,
): ViewElement {
  if (typeof value === "string") {
    return createTableTextElement({ text: value, variant, isSelected });
  }
  return value;
}

function resolveTableWidths(columns: number, totalWidth: number, overrides?: number[]): number[] {
  if (columns === 0) return [];
  const base = Math.max(1, Math.floor(totalWidth / columns));
  return Array.from({ length: columns }, (_, idx) => {
    const override = overrides?.[idx];
    if (typeof override === "number") {
      return Math.max(1, Math.min(totalWidth, Math.floor(override)));
    }
    return base;
  });
}

const tableOffsets = new Map<string, number>();

function getTableOffset(key?: string): number {
  if (!key) return 0;
  return tableOffsets.get(key) ?? 0;
}

function setTableOffset(key: string | undefined, offset: number) {
  if (!key) return;
  tableOffsets.set(key, offset);
}

function handleTableKey(element: TableElement, key: KeyEvent): boolean {
  if (!element.focusKey) return false;
  const rect = element.innerRect ?? element.rect;
  if (!rect) return false;

  // If using external selection management, don't handle keys here
  if (element.onRowSelect !== undefined) {
    return false;
  }

  const headerLines = element.headers && element.headers.length > 0 ? 1 : 0;
  const visibleRows = rect.height - headerLines;
  if (visibleRows <= 0) return false;
  let offset = getTableOffset(element.focusKey);
  const maxOffset = Math.max(0, element.rows.length - visibleRows);

  if (key.name === "down" || key.name === "j") {
    offset = Math.min(maxOffset, offset + 1);
  } else if (key.name === "up" || key.name === "k") {
    offset = Math.max(0, offset - 1);
  } else {
    return false;
  }

  setTableOffset(element.focusKey, offset);
  return true;
}

function pad(text: string, width: number) {
  const truncated = text.slice(0, width);
  return truncated.padEnd(width, " ");
}
