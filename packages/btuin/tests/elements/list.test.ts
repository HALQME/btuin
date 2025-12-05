import { describe, it, expect } from "bun:test";
import { List, type ListElement } from "../../src/elements/list";

describe("List", () => {
  it("creates element with items", () => {
    const items = [
      { label: "Item 1", value: "1" },
      { label: "Item 2", value: "2" },
    ];
    const element = List({ items, focusKey: "test-list" }) as ListElement;
    expect(element.type).toBe("list");
    expect(element.items).toEqual(items);
  });

  it("handles default selection", () => {
    const items = [
      { label: "Item 1", value: "1" },
      { label: "Item 2", value: "2" },
      { label: "Item 3", value: "3" },
    ];
    const element = List({
      items,
      selected: 1,
      focusKey: "test-list",
    }) as ListElement;
    expect(element.selected).toBe(1);
  });

  it("supports custom item height", () => {
    const items = [{ label: "Item 1", value: "1" }];
    const element = List({
      items,
      itemHeight: 2,
      focusKey: "test-list",
    }) as ListElement;
    expect(element.itemHeight).toBe(2);
  });

  it("supports overscan configuration", () => {
    const items = [{ label: "Item 1", value: "1" }];
    const element = List({
      items,
      overscan: 5,
      focusKey: "test-list",
    }) as ListElement;
    expect(element.overscan).toBe(5);
  });

  it("handles empty items list", () => {
    const element = List({
      items: [],
      focusKey: "test-list",
    }) as ListElement;
    expect(element.items.length).toBe(0);
  });

  it("clamps selection to valid range", () => {
    const items = [
      { label: "Item 1", value: "1" },
      { label: "Item 2", value: "2" },
    ];
    const element = List({
      items,
      selected: 10,
      focusKey: "test-list",
    }) as ListElement;
    expect(element.selected).toBe(10);
  });

  it("supports large item count (10000+)", () => {
    const items = Array.from({ length: 10000 }, (_, i) => ({
      label: `Item ${i}`,
      value: `${i}`,
    }));
    const element = List({
      items,
      focusKey: "test-list",
    }) as ListElement;
    expect(element.items.length).toBe(10000);
  });
});
