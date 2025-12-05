import { describe, it, expect } from "bun:test";
import { ProgressBar, type ProgressBarElement } from "../src/progress-bar";

describe("ProgressBar", () => {
  it("creates element with required props", () => {
    const element = ProgressBar({ value: 50 }) as ProgressBarElement;
    expect(element.type).toBe("progress-bar");
    expect(element.value).toBe(50);
  });

  it("clamps value between 0 and max", () => {
    const element = ProgressBar({ value: 150, max: 100 }) as ProgressBarElement;
    expect(element.value).toBe(150);
    expect(element.max).toBe(100);
  });

  it("uses default max value of 100", () => {
    const element = ProgressBar({ value: 50 }) as ProgressBarElement;
    expect(element.max).toBeUndefined();
  });

  it("supports custom max value", () => {
    const element = ProgressBar({ value: 25, max: 200 }) as ProgressBarElement;
    expect(element.value).toBe(25);
    expect(element.max).toBe(200);
  });

  it("supports percentage display", () => {
    const element = ProgressBar({
      value: 75,
      showPercentage: true,
    }) as ProgressBarElement;
    expect(element.showPercentage).toBe(true);
  });

  it("supports label display", () => {
    const element = ProgressBar({
      value: 30,
      max: 100,
      showLabel: true,
    }) as ProgressBarElement;
    expect(element.showLabel).toBe(true);
  });

  it("supports width and height", () => {
    const element = ProgressBar({
      value: 50,
      width: 50,
      height: 2,
    }) as ProgressBarElement;
    expect(element.width).toBe(50);
    expect(element.height).toBe(2);
  });

  it("handles focus key", () => {
    const element = ProgressBar({
      value: 50,
      focusKey: "progress-1",
    }) as ProgressBarElement;
    expect(element.focusKey).toBe("progress-1");
  });

  it("handles zero progress", () => {
    const element = ProgressBar({ value: 0 }) as ProgressBarElement;
    expect(element.value).toBe(0);
  });

  it("handles full progress", () => {
    const element = ProgressBar({ value: 100 }) as ProgressBarElement;
    expect(element.value).toBe(100);
  });

  it("handles custom max with partial progress", () => {
    const element = ProgressBar({ value: 50, max: 200 }) as ProgressBarElement;
    expect(element.value).toBe(50);
    expect(element.max).toBe(200);
  });
});
