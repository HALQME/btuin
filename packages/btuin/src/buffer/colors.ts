import type { ColorValue } from "@btuin/types/color";

export function resolveColor(value: ColorValue, channel: "fg" | "bg"): string | undefined {
  if (typeof value === "number") {
    return channel === "fg" ? `\x1b[38;5;${value}m` : `\x1b[48;5;${value}m`;
  }

  if (typeof value === "string") {
    if (value.startsWith("\x1b[")) {
      return channel === "fg" ? value : swapToBackgroundChannel(value);
    }

    try {
      const seq = Bun.color(value, "ansi");
      if (!seq) return undefined;
      return channel === "fg" ? seq : swapToBackgroundChannel(seq);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function swapToBackgroundChannel(seq: string): string {
  // Bun.color always emits foreground escape codes, so swap the CSI prefix to use the BG channel.
  return seq.replace("[38;", "[48;");
}
