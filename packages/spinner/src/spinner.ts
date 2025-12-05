import {
  defineElement,
  drawText,
  fillRect,
  type BaseElement,
  type SizeValue,
  type ViewElement,
} from "@btuin/element-kit";

export interface SpinnerProps extends BaseElement {
  width?: SizeValue;
  height?: SizeValue;
  text?: string;
}

export interface SpinnerElement extends SpinnerProps {
  type: "spinner";
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const spinnerState = new Map<string, number>();

const createSpinnerElement = defineElement<SpinnerElement>("spinner", {
  render(element, buf) {
    const rect = element.innerRect ?? element.rect;
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

    const focusKey = element.focusKey || "default";

    // Get current frame index for this spinner
    let frameIndex = spinnerState.get(focusKey) ?? 0;
    frameIndex = (frameIndex + 1) % SPINNER_FRAMES.length;
    spinnerState.set(focusKey, frameIndex);

    const frame = SPINNER_FRAMES[frameIndex];
    const text = element.text || "Loading...";
    const displayText = `${frame} ${text}`;
    const truncated = displayText.slice(0, rect.width);

    // Fill background
    fillRect(buf, rect.y, rect.x, rect.width, rect.height, " ");

    // Draw spinner and text
    if (rect.width > 0) {
      drawText(buf, rect.y, rect.x, truncated.padEnd(rect.width, " "), {
        fg: "magenta",
      });
    }
  },
});

export function Spinner(props: SpinnerProps): ViewElement {
  return createSpinnerElement(props);
}
