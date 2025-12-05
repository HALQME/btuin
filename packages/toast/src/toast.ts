import {
  defineElement,
  drawText,
  fillRect,
  type BaseElement,
  type SizeValue,
  type ViewElement,
} from "@btuin/element-kit";

export type ToastSeverity = "info" | "success" | "warning" | "error";

export interface ToastProps extends BaseElement {
  message: string;
  severity?: ToastSeverity;
  width?: SizeValue;
  height?: SizeValue;
  duration?: number;
}

export interface ToastElement extends ToastProps {
  type: "toast";
}

const severityIcons: Record<ToastSeverity, string> = {
  info: "ℹ",
  success: "✓",
  warning: "⚠",
  error: "✕",
};

const severityColors: Record<ToastSeverity, string> = {
  info: "blue",
  success: "green",
  warning: "yellow",
  error: "red",
};

const createToastElement = defineElement<ToastElement>("toast", {
  render(element, buf) {
    const rect = element.innerRect ?? element.rect;
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

    const severity = element.severity || "info";
    const icon = severityIcons[severity];
    const color = severityColors[severity];

    // Fill background
    fillRect(buf, rect.y, rect.x, rect.width, rect.height, " ");

    // Draw border if height > 1
    if (rect.height >= 2) {
      fillRect(buf, rect.y, rect.x, rect.width, 1, "─", {
        fg: color,
      });
      fillRect(buf, rect.y + rect.height - 1, rect.x, rect.width, 1, "─", { fg: color });
    }

    // Draw message with icon
    const messagePrefix = `${icon} `;
    const displayText = (messagePrefix + element.message)
      .slice(0, rect.width)
      .padEnd(rect.width, " ");

    const messageRow = rect.height >= 2 ? rect.y + 1 : rect.y;
    drawText(buf, messageRow, rect.x, displayText, {
      fg: color,
    });
  },
});

export function Toast(props: ToastProps): ViewElement {
  return createToastElement(props);
}
