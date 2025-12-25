import { describe, it, expect } from "bun:test";
import { Windowed } from "@/view";
import { Text } from "@/view/primitives";

describe("Windowed", () => {
  it("renders a visible slice from startIndex", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const el = Windowed({
      items,
      startIndex: 3,
      viewportRows: 4,
      itemHeight: 1,
      overscan: 0,
      renderItem: (item) => Text(`item ${item}`),
    }).build();

    expect(el.type).toBe("block");
    expect(el.style.flexDirection).toBe("column");
    expect(el.style.height).toBe(4);
    expect(el.style.flexShrink).toBe(0);
    expect(el.children).toHaveLength(4);
    expect(el.children[0]!.type).toBe("text");
    expect((el.children[0] as any).content).toBe("item 3");
    expect((el.children[3] as any).content).toBe("item 6");
  });

  it("applies overscan after the viewport", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const el = Windowed({
      items,
      startIndex: 0,
      viewportRows: 3,
      itemHeight: 1,
      overscan: 2,
      renderItem: (item) => Text(`item ${item}`),
    }).build();

    expect(el.children).toHaveLength(5);
    expect((el.children[4] as any).content).toBe("item 4");
  });

  it("uses keyPrefix for stable item keys when missing", () => {
    const items = ["a", "b", "c"];
    const el = Windowed({
      items,
      startIndex: 1,
      viewportRows: 2,
      itemHeight: 1,
      overscan: 0,
      keyPrefix: "list",
      renderItem: (item) => Text(item),
    }).build();

    expect(el.children).toHaveLength(2);
    expect(el.children[0]!.key).toBe("list/1");
    expect(el.children[0]!.identifier).toBe("list/1");
    expect(el.children[1]!.key).toBe("list/2");
  });
});
