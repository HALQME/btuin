import { describe, it, expect } from "bun:test";
import { Toast, type ToastElement } from "../src/toast";

describe("Toast", () => {
  it("creates element with message", () => {
    const element = Toast({
      message: "Hello, World!",
      focusKey: "test-toast",
    }) as ToastElement;
    expect(element.type).toBe("toast");
    expect(element.message).toBe("Hello, World!");
  });

  it("supports toast type info", () => {
    const element = Toast({
      message: "Info message",
      severity: "info",
      focusKey: "test-toast",
    }) as ToastElement;
    expect(element.type).toBe("toast");
  });

  it("supports toast type success", () => {
    const element = Toast({
      message: "Success!",
      severity: "success",
      focusKey: "test-toast",
    }) as ToastElement;
    expect(element.type).toBe("toast");
  });

  it("supports toast type warning", () => {
    const element = Toast({
      message: "Warning!",
      severity: "warning",
      focusKey: "test-toast",
    }) as ToastElement;
    expect(element.type).toBe("toast");
  });

  it("supports toast type error", () => {
    const element = Toast({
      message: "Error!",
      severity: "error",
      focusKey: "test-toast",
    }) as ToastElement;
    expect(element.type).toBe("toast");
  });

  it("supports duration", () => {
    const element = Toast({
      message: "Auto-dismiss",
      duration: 3000,
      focusKey: "test-toast",
    }) as ToastElement;
    expect(element.duration).toBe(3000);
  });

  it("supports width and height", () => {
    const element = Toast({
      message: "Sized toast",
      width: 40,
      height: 3,
      focusKey: "test-toast",
    }) as ToastElement;
    expect(element.width).toBe(40);
    expect(element.height).toBe(3);
  });

  it("handles empty message", () => {
    const element = Toast({
      message: "",
      focusKey: "test-toast",
    }) as ToastElement;
    expect(element.message).toBe("");
  });

  it("handles long message", () => {
    const longMessage = "A".repeat(100);
    const element = Toast({
      message: longMessage,
      focusKey: "test-toast",
    }) as ToastElement;
    expect(element.message).toBe(longMessage);
  });

  it("supports multiple toast instances", () => {
    const toast1 = Toast({
      message: "Toast 1",
      severity: "info",
      focusKey: "toast-1",
    }) as ToastElement;

    const toast2 = Toast({
      message: "Toast 2",
      severity: "error",
      focusKey: "toast-2",
    }) as ToastElement;

    expect(toast1.focusKey).toBe("toast-1");
    expect(toast2.focusKey).toBe("toast-2");
    expect(toast1.message).toBe("Toast 1");
    expect(toast2.message).toBe("Toast 2");
  });
});
