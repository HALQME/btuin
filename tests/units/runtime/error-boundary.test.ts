import { describe, it, expect, mock } from "bun:test";
import {
  createErrorHandler,
  createErrorContext,
  type ErrorContext,
} from "@/runtime/error-boundary";
import { type WriteStream } from "fs";

// Mock the 'fs' module
let logContent = "";
const mockStream = {
  write: (chunk: string) => {
    logContent += chunk;
  },
  end: () => {},
};

mock.module("fs", () => ({
  createWriteStream: (path: string, options: any): WriteStream => {
    logContent = ""; // Reset for each test
    return mockStream as any;
  },
}));

describe("Error Boundary", () => {
  describe("createErrorContext", () => {
    it("should create an error context from an Error object", () => {
      const error = new Error("Test error");
      const context = createErrorContext("render", error, { id: 1 });
      expect(context.phase).toBe("render");
      expect(context.error).toBe(error);
      expect(context.metadata).toEqual({ id: 1 });
    });

    it("should create an error context from a non-Error object", () => {
      const error = "A string error";
      const context = createErrorContext("tick", error);
      expect(context.phase).toBe("tick");
      expect(context.error).toBeInstanceOf(Error);
      expect(context.error.message).toBe("A string error");
    });
  });

  describe("createErrorHandler", () => {
    it("should call the user-provided error handler", () => {
      let receivedContext: ErrorContext | null = null;
      const userHandler = (context: ErrorContext) => {
        receivedContext = context;
      };
      const errorHandler = createErrorHandler(userHandler);
      const context = createErrorContext("render", new Error("test"));

      errorHandler(context);

      expect(receivedContext).not.toBeNull();
      expect(receivedContext!).toBe(context);
    });

    it("should log errors to a file if a path is provided", () => {
      const errorHandler = createErrorHandler(undefined, "error.log");
      const error = new Error("File log test");
      error.stack = "stack-trace";
      const context = createErrorContext("mount", error, { info: "test" });

      errorHandler(context);

      expect(logContent).toContain("Error in mount phase");
      expect(logContent).toContain("Message: File log test");
      expect(logContent).toContain('Metadata: {"info":"test"}');
      expect(logContent).toContain("Stack: stack-trace");
    });

    it("should handle errors within the user handler", () => {
      const handlerError = new Error("Handler failed");
      const userHandler = () => {
        throw handlerError;
      };
      const errorHandler = createErrorHandler(userHandler, "error.log");
      const context = createErrorContext("key", new Error("Original error"));

      errorHandler(context);

      // Check that the error from the handler itself is logged
      expect(logContent).toContain("Error in onError handler (key)");
      expect(logContent).toContain("Message: Handler failed");
      expect(logContent).toContain("Original error: Original error");
    });
  });
});
