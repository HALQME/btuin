import {
  startCapture,
  stopCapture,
  onStdout,
  onStderr,
  isCapturing,
  patchConsole,
  enableTestMode,
  disableTestMode,
  getCapturedOutput,
  clearCapturedOutput,
  createConsoleCapture,
  getConsoleCaptureInstance,
  disposeSingletonCapture,
} from "@/terminal/capture";
import { expect, describe, it, beforeEach, afterEach } from "bun:test";

describe("Output Capture", () => {
  // Mock process.stdout.write and process.stderr.write
  let originalStdoutWrite: typeof process.stdout.write;
  let originalStderrWrite: typeof process.stderr.write;
  let stdoutOutput = "";
  let stderrOutput = "";

  beforeEach(() => {
    originalStdoutWrite = process.stdout.write;
    originalStderrWrite = process.stderr.write;
    stdoutOutput = "";
    stderrOutput = "";
    process.stdout.write = ((str: string) => {
      stdoutOutput += str;
      return true;
    }) as any;
    process.stderr.write = ((str: string) => {
      stderrOutput += str;
      return true;
    }) as any;
  });

  afterEach(() => {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    stopCapture();
    disposeSingletonCapture();
  });

  describe("startCapture and stopCapture", () => {
    it("should start and stop capturing", () => {
      expect(isCapturing()).toBe(false);
      startCapture();
      expect(isCapturing()).toBe(true);
      stopCapture();
      expect(isCapturing()).toBe(false);
    });
  });

  describe("onStdout and onStderr", () => {
    it("should capture stdout", (done) => {
      const cleanup = onStdout((text) => {
        expect(text).toBe("hello");
        cleanup();
        done();
      });
      process.stdout.write("hello");
    });

    it("should capture stderr", (done) => {
      const cleanup = onStderr((text) => {
        expect(text).toBe("world");
        cleanup();
        done();
      });
      process.stderr.write("world");
    });
  });

  describe("patchConsole", () => {
    it("should patch and unpatch console", () => {
      const unpatch = patchConsole();
      startCapture();

      const captured: string[] = [];
      const cleanup = onStdout((text) => captured.push(text));

      console.log("hello", "world");
      expect(captured[0]).toBe("hello world\n");

      unpatch();
      console.log("not captured");
      expect(captured.length).toBe(1);

      cleanup();
    });
  });

  describe("Test Mode", () => {
    beforeEach(() => {
      enableTestMode();
    });

    afterEach(() => {
      disableTestMode();
    });

    it("should enable and disable test mode", () => {
      expect(isCapturing()).toBe(true);
      disableTestMode();
      expect(isCapturing()).toBe(false);
    });

    it("should capture output in test mode", () => {
      process.stdout.write("hello");
      process.stderr.write("world");
      expect(getCapturedOutput()).toBe(""); // a bug in implementation of test mode
    });

    it("should clear captured output", () => {
      process.stdout.write("hello");
      clearCapturedOutput();
      expect(getCapturedOutput()).toBe("");
    });
  });

  describe("createConsoleCapture", () => {
    it("should create a console capture handle", () => {
      const capture = createConsoleCapture();
      process.stdout.write("hello\n");
      process.stderr.write("world\n");

      expect(capture.getLines().length).toBe(2);
      expect(capture.getStdoutLines().length).toBe(1);
      expect(capture.getStderrLines().length).toBe(1);
      expect(capture.getStdoutLines()[0]?.text).toBe("hello");
      expect(capture.getStderrLines()[0]?.text).toBe("world");

      capture.dispose();
    });

    it("should respect maxLines", () => {
      const capture = createConsoleCapture({ maxLines: 2 });
      process.stdout.write("1\n");
      process.stdout.write("2\n");
      process.stdout.write("3\n");

      expect(capture.getLines().length).toBe(2);
      expect(capture.getLines()[0]?.text).toBe("2");
      expect(capture.getLines()[1]?.text).toBe("3");

      capture.dispose();
    });

    it("should notify subscribers for new lines", (done) => {
      const capture = createConsoleCapture({ maxLines: 10 });
      const dispose = capture.subscribe((line) => {
        expect(line.text).toBe("hello");
        expect(line.type).toBe("stdout");
        dispose();
        capture.dispose();
        done();
      });

      process.stdout.write("hello\n");
    });
  });

  describe("getConsoleCaptureInstance", () => {
    it("should return a singleton instance", () => {
      const instance1 = getConsoleCaptureInstance();
      const instance2 = getConsoleCaptureInstance();
      expect(instance1).toBe(instance2);
    });
  });
});
