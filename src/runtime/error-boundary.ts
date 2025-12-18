/**
 * Error Boundary Module
 *
 * Handles error contexts and provides error handling utilities for the runtime.
 */

/**
 * Error context information for error handlers
 */
export interface ErrorContext {
  /** The phase where the error occurred */
  phase: "init" | "render" | "effect" | "key" | "tick" | "resize" | "mount";
  /** The original error object */
  error: Error;
  /** Optional additional context */
  metadata?: Record<string, unknown>;
}

/**
 * Error handler function type
 */
export type ErrorHandler = (context: ErrorContext) => void;

/**
 * Creates an error handler wrapper that manages error recovery
 *
 * @param userHandler - Optional user-provided error handler
 * @param errorLogPath - Optional file path to write error logs to
 * @returns Error handling function
 */
import { createWriteStream } from "fs";
import { getOriginalStderr } from "../terminal";

// ...

export function createErrorHandler(
  userHandler: ErrorHandler | undefined,
  errorLogPath?: string,
): (context: ErrorContext) => void {
  return (context: ErrorContext): void => {
    // Log error to file if provided
    if (errorLogPath) {
      const timestamp = new Date().toISOString();
      const errorText =
        `[${timestamp}] Error in ${context.phase} phase:\n` +
        `  Message: ${context.error.message}\n` +
        (context.metadata ? `  Metadata: ${JSON.stringify(context.metadata)}\n` : "") +
        `  Stack: ${context.error.stack}\n\n`;

      const errorLogStream = createWriteStream(errorLogPath, { flags: "a" });
      errorLogStream.write(errorText);
      errorLogStream.end();
    }

    if (userHandler) {
      try {
        userHandler(context);
      } catch (handlerError) {
        // Log handler error to file if provided
        if (errorLogPath) {
          const timestamp = new Date().toISOString();
          const handlerErrorText =
            `[${timestamp}] Error in onError handler (${context.phase}):\n` +
            `  Message: ${handlerError instanceof Error ? handlerError.message : String(handlerError)}\n` +
            `  Original error: ${context.error.message}\n\n`;

          const errorLogStream = createWriteStream(errorLogPath, { flags: "a" });
          errorLogStream.write(handlerErrorText);
          errorLogStream.end();
        }
      }
    } else if (!errorLogPath) {
      const meta = context.metadata ? `\nmetadata: ${JSON.stringify(context.metadata)}` : "";
      const stack = context.error.stack ? `\n${context.error.stack}` : "";
      getOriginalStderr().write(
        `[btuin] error(${context.phase}): ${context.error.message}${meta}${stack}\n`,
      );
    }
  };
}

/**
 * Wraps an error object in an ErrorContext
 *
 * @param phase - The phase where the error occurred
 * @param error - The error object
 * @param metadata - Optional additional context
 * @returns ErrorContext object
 */
export function createErrorContext(
  phase: ErrorContext["phase"],
  error: unknown,
  metadata?: Record<string, unknown>,
): ErrorContext {
  return {
    phase,
    error: error instanceof Error ? error : new Error(String(error)),
    metadata,
  };
}
