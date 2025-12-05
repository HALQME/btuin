import {
  type BaseElement,
  type OutlineOptions,
  type SizeValue,
  type ViewElement,
} from "@btuin/element-kit";
import { createTableElement } from "./modules";

export type TableCellValue = ViewElement | string;

export interface TableProps extends BaseElement {
  headers?: TableCellValue[];
  rows: TableCellValue[][];
  columnWidths?: number[];
  width?: SizeValue;
  height?: SizeValue;
  outline?: OutlineOptions;
  focusKey?: string;
  selectedIndex?: number;
  onRowSelect?: (index: number) => void;
}

export interface TableElement extends TableProps {
  type: "table";
  headerCells?: ViewElement[];
  rowCells?: ViewElement[][];
  scrollOffset?: number;
  selectedIndex?: number;
  onRowSelect?: (index: number) => void;
}

export interface TableTextElement extends BaseElement {
  type: "table:text";
  text: string;
  variant: "header" | "body";
  isSelected?: boolean;
}

export function Table(props: TableProps): ViewElement {
  return createTableElement(props as TableElement);
}
