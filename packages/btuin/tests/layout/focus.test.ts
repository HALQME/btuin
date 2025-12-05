import { describe, it, expect, mock } from "bun:test";
import {
  collectFocusTargets,
  handleInternalElementKey,
  registerElementModule,
} from "../../src/layout";
import type { ViewElement, LaidOutElement } from "@btuin/types/elements";

describe("focus helpers", () => {
  it("collects focus targets through nested trees", () => {
    const child: ViewElement = {
      type: "paragraph",
      text: "hi",
      focusKey: "name",
      rect: { x: 1, y: 1, width: 2, height: 1 },
    } as any;
    const parent: LaidOutElement = {
      type: "box",
      rect: { x: 0, y: 0, width: 4, height: 4 },
      focusKey: "box",
      child,
    } as any;

    const targets = collectFocusTargets(parent as LaidOutElement);

    expect(targets.map((t) => t.key)).toEqual(["box", "name"]);
    expect(targets[0]?.rect).toEqual(parent.rect);
    expect(targets[1]?.rect).toEqual(child.rect);
  });

  it("delegates to element module collect and handleKey", () => {
    const module = {
      collectFocus: mock((element, acc, helpers) => {
        acc.push({ key: "custom", rect: element.rect!, element });
        helpers.collectChild({ ...element, type: "paragraph", focusKey: "nested" });
      }),
      handleKey: mock(() => true),
    };
    registerElementModule("custom-focus", module as any);

    const element: LaidOutElement = {
      type: "custom-focus",
      rect: { x: 0, y: 0, width: 1, height: 1 },
    } as any;
    const targets = collectFocusTargets(element);
    const handled = handleInternalElementKey(element, { key: "enter" } as any);

    expect(module.collectFocus.mock.calls.length).toBe(1);
    expect(targets.map((t) => t.key)).toEqual(["custom", "nested"]);
    expect(handled).toBe(true);
  });
});
