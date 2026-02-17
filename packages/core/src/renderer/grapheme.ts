const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

export function segmentGraphemes(text: string): string[] {
  if (!text) return [];

  const segments: string[] = [];
  for (const segment of graphemeSegmenter.segment(text)) {
    if (segment.segment) {
      segments.push(segment.segment);
    }
  }
  return segments;
}

export function measureGraphemeWidth(cluster: string): number {
  return Bun.stringWidth(cluster);
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
