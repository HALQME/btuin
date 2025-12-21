import { describe, expect, test, beforeAll } from "bun:test";
import { layout, renderElement } from "@/layout";
import { Text, ZStack } from "@/index";
import { createBuffer } from "@/renderer";

function bufferToString(buf: ReturnType<typeof createBuffer>): string {
  let out = "";
  for (let r = 0; r < buf.rows; r++) {
    for (let c = 0; c < buf.cols; c++) {
      out += String.fromCodePoint(buf.get(r, c).char.codePointAt(0)!);
    }
    out += "\n";
  }
  return out;
}

describe("ZStack", () => {
  beforeAll(async () => {});

  test("should overlay children at the same origin", () => {
    const root = ZStack([
      Text("Hello"), //
      Text("X"),
    ])
      .setKey("root")
      .width(5)
      .height(1)
      .build();

    const layoutMap = layout(root, { width: 5, height: 1 });
    const buffer = createBuffer(1, 5);

    renderElement(root, buffer, layoutMap);

    expect(bufferToString(buffer)).toBe("Xello\n");
  });
});
