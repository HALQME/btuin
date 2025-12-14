import type { ColorValue } from "./types/color";

const colorMap: Record<string, number> = {
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
};

export function resolveColor(value: ColorValue, channel: "fg" | "bg"): string | undefined {
  if (typeof value === "number") {
    return channel === "fg" ? `\x1b[38;5;${value}m` : `\x1b[48;5;${value}m`;
  }

  if (typeof value === "string") {
    if (value.startsWith("\x1b[")) {
      return channel === "fg" ? value : value.replace("[38;", "[48;");
    }

    const colorCode = colorMap[value.toLowerCase()];
    if (colorCode) {
      return channel === "fg" ? `\x1b[${colorCode}m` : `\x1b[${colorCode + 10}m`;
    }
  }

  return undefined;
}
