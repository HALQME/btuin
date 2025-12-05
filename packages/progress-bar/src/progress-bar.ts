import {
  defineElement,
  drawText,
  fillRect,
  type BaseElement,
  type SizeValue,
  type ViewElement,
} from "@btuin/element-kit";

export interface ProgressBarProps extends BaseElement {
  value: number;
  max?: number;
  width?: SizeValue;
  height?: SizeValue;
  showLabel?: boolean;
  showPercentage?: boolean;
}

export interface ProgressBarElement extends ProgressBarProps {
  type: "progress-bar";
}

const createProgressBarElement = defineElement<ProgressBarElement>("progress-bar", {
  render(element, buf) {
    const rect = element.innerRect ?? element.rect;
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

    const max = element.max ?? 100;
    const value = Math.max(0, Math.min(element.value, max));
    const percentage = (value / max) * 100;
    const filledWidth = Math.round((rect.width * value) / max);

    // Fill background
    fillRect(buf, rect.y, rect.x, rect.width, rect.height, " ");

    // Draw filled portion
    if (filledWidth > 0) {
      fillRect(buf, rect.y, rect.x, Math.min(filledWidth, rect.width), rect.height, "█", {
        fg: "magenta",
      });
    }

    // Draw remaining portion
    const remainingWidth = rect.width - filledWidth;
    if (remainingWidth > 0) {
      fillRect(buf, rect.y, rect.x + filledWidth, remainingWidth, rect.height, "░", { fg: "white" });
    }

    // Draw label or percentage
    if (element.showPercentage || element.showLabel) {
      const label = element.showPercentage
        ? `${percentage.toFixed(0)}%`
        : element.showLabel
          ? `${value}/${max}`
          : "";
      if (label && rect.width > label.length) {
        const startCol = rect.x + Math.max(0, Math.floor((rect.width - label.length) / 2));
        drawText(buf, rect.y, startCol, label, {
          fg: "white",
        });
      }
    }
  },
});

export function ProgressBar(props: ProgressBarProps): ViewElement {
  return createProgressBarElement(props);
}
