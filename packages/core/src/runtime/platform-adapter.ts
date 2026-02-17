import { getUiOutputStream } from "../terminal/tty-streams";

export interface PlatformAdapter {
  onStdoutResize(handler: () => void): () => void;
  onExit(handler: () => void): void;
  onSigint(handler: () => void): void;
  onSigterm(handler: () => void): void;
  exit(code: number): void;
  getEnv?(name: string): string | undefined;
}

export function createDefaultPlatformAdapter(): PlatformAdapter {
  return {
    onStdoutResize: (handler) => {
      const stream = getUiOutputStream() as any;
      if (typeof stream?.on !== "function" || typeof stream?.off !== "function") {
        return () => {};
      }
      stream.on("resize", handler);
      return () => stream.off("resize", handler);
    },
    onExit: (handler) => {
      process.once("exit", handler);
    },
    onSigint: (handler) => {
      process.once("SIGINT", handler);
    },
    onSigterm: (handler) => {
      process.once("SIGTERM", handler);
    },
    exit: (code) => {
      process.exit(code);
    },
    getEnv: (name) => process.env[name],
  };
}
