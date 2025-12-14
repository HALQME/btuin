export interface PlatformAdapter {
  onStdoutResize(handler: () => void): void;
  onExit(handler: () => void): void;
  onSigint(handler: () => void): void;
  onSigterm(handler: () => void): void;
  exit(code: number): void;
}

export function createDefaultPlatformAdapter(): PlatformAdapter {
  return {
    onStdoutResize: (handler) => {
      process.stdout.on("resize", handler);
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
  };
}
