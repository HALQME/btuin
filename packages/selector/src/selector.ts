import {
  defineElement,
  drawText,
  fillRect,
  type BaseElement,
  type KeyEvent,
  type OutlineOptions,
  type SizeValue,
  type ViewElement,
} from "@btuin/element-kit";

export interface SelectorOption {
  label: string;
  value: string;
}

export interface SelectorProps extends BaseElement {
  options: SelectorOption[];
  selected?: number;
  width?: SizeValue;
  height?: SizeValue;
  outline?: OutlineOptions;
  focusKey?: string;
}

export interface SelectorElement extends SelectorProps {
  type: "selector";
}

const selectionState = new Map<string, number>();

const createSelectorElement = defineElement<SelectorElement>("selector", {
  render(element, buf) {
    const rect = element.innerRect ?? element.rect;
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    const current = getSelectedIndex(element);
    fillRect(buf, rect.y, rect.x, rect.width, rect.height, " ");

    for (let i = 0; i < rect.height; i++) {
      const option = element.options[i];
      if (!option) break;
      const isSelected = i === current;
      const prefix = isSelected ? "▶ " : "  ";
      const text = `${prefix}${option.label}`.slice(0, rect.width);
      drawText(buf, rect.y + i, rect.x, text.padEnd(rect.width, " "), {
        fg: isSelected ? "magenta" : "white",
      });
    }
  },
  handleKey(element, key: KeyEvent) {
    if (!element.focusKey || element.options.length === 0) return false;
    const current = getSelectedIndex(element);
    let next = current;
    if (key.name === "down" || key.name === "j") {
      next = (current + 1) % element.options.length;
    } else if (key.name === "up" || key.name === "k") {
      next = (current - 1 + element.options.length) % element.options.length;
    } else {
      return false;
    }

    selectionState.set(element.focusKey, next);
    return true;
  },
});

export function Selector(props: SelectorProps): ViewElement {
  return createSelectorElement(props);
}

function getSelectedIndex(element: SelectorElement): number {
  if (element.focusKey && selectionState.has(element.focusKey)) {
    return selectionState.get(element.focusKey)!;
  }
  return Math.max(0, Math.min(element.options.length - 1, element.selected ?? 0));
}
