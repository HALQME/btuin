const graphemeSegmenter = (() => {
  try {
    if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
      return new Intl.Segmenter(undefined, { granularity: "grapheme" });
    }
  } catch {
    /* fall back to manual segmentation */
  }
  return null;
})();

const COMBINING_RANGES: [number, number][] = [
  [0x0300, 0x036f],
  [0x1ab0, 0x1aff],
  [0x1dc0, 0x1dff],
  [0x20d0, 0x20ff],
  [0xfe20, 0xfe2f],
  [0x200c, 0x200d],
];

const WIDE_RANGES: [number, number][] = [
  [0x1100, 0x115f],
  [0x2329, 0x232a],
  [0x2e80, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x1f300, 0x1f64f],
  [0x1f900, 0x1f9ff],
  [0x20000, 0x2fffd],
  [0x30000, 0x3fffd],
];

function inRange(code: number, ranges: [number, number][]): boolean {
  for (const [start, end] of ranges) {
    if (code >= start && code <= end) {
      return true;
    }
  }
  return false;
}

function isCombining(code: number): boolean {
  return inRange(code, COMBINING_RANGES);
}

function isWide(code: number): boolean {
  return inRange(code, WIDE_RANGES);
}

function isControl(code: number): boolean {
  return (code >= 0 && code < 32) || (code >= 0x7f && code < 0xa0);
}

export function segmentGraphemes(text: string): string[] {
  if (!text) return [];

  if (graphemeSegmenter) {
    const segments: string[] = [];
    for (const segment of graphemeSegmenter.segment(text)) {
      if (segment.segment) {
        segments.push(segment.segment);
      }
    }
    return segments;
  }

  const fallback: string[] = [];
  let buffer = "";

  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (buffer && isCombining(code)) {
      buffer += char;
      continue;
    }
    if (buffer) {
      fallback.push(buffer);
    }
    buffer = char;
  }

  if (buffer) {
    fallback.push(buffer);
  }

  return fallback;
}

export function measureGraphemeWidth(cluster: string): number {
  for (const char of cluster) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    if (isControl(code)) return 0;
    if (isCombining(code)) continue;
    return isWide(code) ? 2 : 1;
  }
  return cluster ? 1 : 0;
}

export function measureTextWidth(text: string): number {
  if (!text) return 0;
  let width = 0;
  for (const cluster of segmentGraphemes(text)) {
    width += measureGraphemeWidth(cluster);
  }
  return width;
}

export function truncateTextWidth(text: string, maxWidth: number, ellipsis = "…"): string {
  const cap = Math.max(0, Math.floor(maxWidth));
  if (cap === 0) return "";
  if (!text) return "";

  if (measureTextWidth(text) <= cap) return text;

  const ellWidth = measureTextWidth(ellipsis);
  if (ellWidth >= cap) {
    // Return a truncated ellipsis that fits into cap.
    let out = "";
    let used = 0;
    for (const cluster of segmentGraphemes(ellipsis)) {
      const w = measureGraphemeWidth(cluster);
      if (used + w > cap) break;
      used += w;
      out += cluster;
    }
    return out;
  }

  const target = cap - ellWidth;
  let out = "";
  let used = 0;
  for (const cluster of segmentGraphemes(text)) {
    const w = measureGraphemeWidth(cluster);
    if (used + w > target) break;
    used += w;
    out += cluster;
  }
  return out + ellipsis;
}

export function wrapTextWidth(text: string, maxWidth: number): string[] {
  const cap = Math.max(1, Math.floor(maxWidth));
  if (!text) return [];

  const out: string[] = [];
  const rawLines = text.split("\n");

  for (const rawLine of rawLines) {
    const line = rawLine.replace(/\s+$/g, "");
    if (line === "") {
      out.push("");
      continue;
    }

    const words = line.split(/\s+/g).filter(Boolean);
    let current = "";
    let currentWidth = 0;

    for (const word of words) {
      const wordWidth = measureTextWidth(word);
      const sep = current ? " " : "";
      const sepWidth = current ? 1 : 0;

      if (currentWidth + sepWidth + wordWidth <= cap) {
        current += `${sep}${word}`;
        currentWidth += sepWidth + wordWidth;
        continue;
      }

      if (current) {
        out.push(current);
        current = "";
        currentWidth = 0;
      }

      if (wordWidth <= cap) {
        current = word;
        currentWidth = wordWidth;
        continue;
      }

      // Hard-wrap a single long token by grapheme width.
      let chunk = "";
      let chunkWidth = 0;
      for (const cluster of segmentGraphemes(word)) {
        const w = measureGraphemeWidth(cluster);
        if (chunkWidth + w > cap && chunk) {
          out.push(chunk);
          chunk = "";
          chunkWidth = 0;
        }
        if (chunkWidth + w > cap) {
          continue;
        }
        chunk += cluster;
        chunkWidth += w;
      }
      if (chunk) {
        current = chunk;
        currentWidth = chunkWidth;
      }
    }

    if (current) out.push(current);
  }

  return out;
}
