import type { Buffer2D } from "../../src/buffer";

export function bufferToLines(buf: Buffer2D): string[] {
  const lines: string[] = [];
  for (let r = 0; r < buf.rows; r++) {
    let line = "";
    for (let c = 0; c < buf.cols; c++) {
      const idx = buf.index(r, c);
      const chCode = buf.cells[idx] || 32;
      line += String.fromCodePoint(chCode);
    }
    lines.push(line);
  }
  return lines;
}
