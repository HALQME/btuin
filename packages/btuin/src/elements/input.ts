import { drawText, fillRect, setCell, type Buffer2D } from "../buffer";
import { defineElement } from "../layout/define-element";
import type { LeafElement } from "@btuin/types/elements";

/**
 * Input element: text input field with optional placeholder and cursor position.
 */
export interface InputElement extends LeafElement {
  type: "input";
  value: string;
  placeholder?: string;
  cursor?: number;
}

/**
 * Type guard for Input elements.
 */
export function isInput(element: any): element is InputElement {
  return element.type === "input";
}

/**
 * TextInput Component
 *
 * A text input field for capturing user input.
 * Supports single-line and multi-line editing with cursor positioning.
 * When focused, displays a cursor and highlights the input field.
 *
 * @example
 * ```typescript
 * import { TextInput } from "btuin";
 *
 * // Simple text input
 * TextInput({
 *   value: state.name,
 *   placeholder: "Enter your name",
 *   focusKey: "nameInput"
 * })
 *
 * // Multi-line input
 * TextInput({
 *   value: state.description,
 *   placeholder: "Enter description",
 *   width: 40,
 *   height: 5,
 *   focusKey: "descInput"
 * })
 *
 * // With cursor position
 * TextInput({
 *   value: state.text,
 *   cursor: state.cursorPos,
 *   focusKey: "textInput"
 * })
 * ```
 *
 * @param props - InputElement properties
 * @param props.value - The current text value of the input
 * @param props.placeholder - Placeholder text shown when value is empty
 * @param props.cursor - Cursor position index (default: end of text)
 * @param props.focusKey - Focus key for keyboard navigation (required for focus)
 * @param props.width - Width of the input field (number or "auto")
 * @param props.height - Height of the input field (number or "auto", default: 1)
 */
export const TextInput = defineElement<InputElement>("input", {
  render(element, buf, options) {
    const focused = Boolean(element.focusKey && element.focusKey === options.activeFocusKey);
    renderInput(element, buf, focused);
  },
});

function renderInput(element: InputElement, buf: Buffer2D, focused: boolean) {
  const rect = element.innerRect ?? element.rect;
  if (!rect || rect.width <= 0 || rect.height <= 0) return;

  fillRect(buf, rect.y, rect.x, rect.width, rect.height, " ");

  const hasValue = element.value.length > 0;
  const display = hasValue ? element.value : (element.placeholder ?? "");
  const lines = display.split("\n");
  const fg = focused ? "magenta" : "gray";

  for (let row = 0; row < rect.height; row++) {
    const textLine = lines[row] ?? "";
    const truncated = textLine.slice(0, rect.width);
    drawText(buf, rect.y + row, rect.x, truncated.padEnd(rect.width, " "), { fg });
  }

  if (!focused) return;

  const cursorText = element.value;
  const cursorIndex = Math.max(0, Math.min(cursorText.length, element.cursor ?? cursorText.length));
  const { row, col } = positionForIndex(cursorText, cursorIndex);
  const clampedRow = Math.max(0, Math.min(rect.height - 1, row));
  const clampedCol = Math.max(0, Math.min(rect.width - 1, col));
  setCell(buf, rect.y + clampedRow, rect.x + clampedCol, { ch: "▌", fg: "white" });
}

function positionForIndex(text: string, index: number) {
  let row = 0;
  let col = 0;
  const limit = Math.max(0, Math.min(index, text.length));
  for (let i = 0; i < limit; i++) {
    if (text[i] === "\n") {
      row += 1;
      col = 0;
    } else {
      col += 1;
    }
  }
  return { row, col };
}
