import { describe, it, expect, mock, beforeAll, beforeEach, afterEach } from "bun:test";
import type { KeyEvent } from "@/terminal/types";

// Mock the 'io' module
mock.module("@/terminal/io", () => ({
  clearScreen: () => {},
  hideCursor: () => {},
  showCursor: () => {},
}));

// Mock process.stdin
const mockStdin = {
  isTTY: true,
  listeners: new Map<string, Function[]>(),
  _rawMode: false,
  setRawMode: (mode: boolean) => {
    mockStdin._rawMode = mode;
  },
  resume: () => {},
  pause: () => {},
  setEncoding: (encoding: string) => {},
  on: (event: string, listener: Function) => {
    const existing = mockStdin.listeners.get(event) || [];
    mockStdin.listeners.set(event, [...existing, listener]);
  },
  off: (event: string, listener: Function) => {
    const existing = mockStdin.listeners.get(event) || [];
    mockStdin.listeners.set(
      event,
      existing.filter((l) => l !== listener),
    );
  },
  listenerCount: (event: string) => (mockStdin.listeners.get(event) || []).length,
  // Helper to simulate data
  emitData: (data: string) => {
    (mockStdin.listeners.get("data") || []).forEach((l) => l(data));
  },
};
Object.defineProperty(process, "stdin", { value: mockStdin });

describe("Raw Mode and Key Handling", () => {
  let setupRawMode: typeof import("@/terminal/raw").setupRawMode;
  let onKey: typeof import("@/terminal/raw").onKey;
  let cleanup: typeof import("@/terminal/raw").cleanup;
  let cleanupWithoutClear: typeof import("@/terminal/raw").cleanupWithoutClear;
  let resetKeyHandlers: typeof import("@/terminal/raw").resetKeyHandlers;

  beforeAll(async () => {
    ({ setupRawMode, onKey, cleanup, cleanupWithoutClear, resetKeyHandlers } =
      await import("@/terminal/raw"));
  });

  beforeEach(() => {
    cleanupWithoutClear();
    resetKeyHandlers();
    mockStdin.listeners.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("should set up and tear down raw mode", () => {
    setupRawMode();
    expect(mockStdin._rawMode).toBe(true);
    cleanup();
    expect(mockStdin._rawMode).toBe(false);
  });

  it("should register a key handler and receive a simple key event", (done) => {
    onKey((event: KeyEvent) => {
      expect(event.name).toBe("a");
      expect(event.sequence).toBe("a");
      expect(event.ctrl).toBe(false);
      expect(event.shift).toBe(false);
      done();
    });
    setupRawMode();
    mockStdin.emitData("a");
  });

  it("should correctly normalize an arrow key", (done) => {
    onKey((event: KeyEvent) => {
      expect(event.name).toBe("up");
      expect(event.ctrl).toBe(false);
      done();
    });
    setupRawMode();
    mockStdin.emitData("\x1b[A");
  });

  // it("should correctly normalize a Ctrl+key combination", (done) => {
  //   onKey((event: KeyEvent) => {
  //     expect(event.name).toBe("c");
  //     expect(event.ctrl).toBe(true);
  //     done();
  //   });
  //   setupRawMode();
  //   mockStdin.emitData("\x03"); // Ctrl+C
  // });

  it("should correctly normalize a Shift+key combination", (done) => {
    onKey((event: KeyEvent) => {
      expect(event.name).toBe("A");
      expect(event.shift).toBe(true);
      done();
    });
    setupRawMode();
    mockStdin.emitData("A");
  });

  it("should correctly normalize a Meta/Alt+key combination", (done) => {
    onKey((event: KeyEvent) => {
      expect(event.name).toBe("b");
      expect(event.meta).toBe(true);
      done();
    });
    setupRawMode();
    mockStdin.emitData("\x1bb"); // Alt+b
  });
});
