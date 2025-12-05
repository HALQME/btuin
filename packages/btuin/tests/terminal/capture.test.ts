import { describe, it, expect } from "bun:test";
import {
  enableTestMode,
  disableTestMode,
  startCapture,
  stopCapture,
  getOriginalStdout,
} from "../../src/terminal/capture";

describe("terminal output capture", () => {
  it("preserves the underlying _write implementation while capturing", () => {
    startCapture();
    try {
      const proxy = getOriginalStdout();
      expect(typeof (proxy as any)._write).toBe("function");
    } finally {
      stopCapture();
    }
  });

  it("keeps _write available in test mode proxies", () => {
    enableTestMode();
    try {
      const proxy = getOriginalStdout();
      expect(typeof (proxy as any)._write).toBe("function");
    } finally {
      disableTestMode();
    }
  });
});
