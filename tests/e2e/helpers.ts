import type { KeyEvent, PlatformAdapter, TerminalAdapter } from "@/types";

export type MockTerminal = TerminalAdapter & {
  output: string;
  clearOutput: () => void;
  pressKey: (key: Partial<KeyEvent>) => void;
  calls: {
    clearScreen: number;
    moveCursor: Array<{ row: number; col: number }>;
    cleanupWithoutClear: number;
    disposeSingletonCapture: number;
    startCapture: number;
    stopCapture: number;
    setupRawMode: number;
    patchConsole: number;
    unpatchConsole: number;
    write: number;
  };
};

export function createMockTerminal(): MockTerminal {
  let keyListeners = new Set<(key: KeyEvent) => void>();
  let output = "";

  const calls: MockTerminal["calls"] = {
    clearScreen: 0,
    moveCursor: [],
    cleanupWithoutClear: 0,
    disposeSingletonCapture: 0,
    startCapture: 0,
    stopCapture: 0,
    setupRawMode: 0,
    patchConsole: 0,
    unpatchConsole: 0,
    write: 0,
  };

  return {
    calls,
    get output() {
      return output;
    },
    clearOutput() {
      output = "";
    },
    pressKey(key: Partial<KeyEvent>) {
      const fullKey: KeyEvent = {
        sequence: "",
        name: "",
        ctrl: false,
        meta: false,
        shift: false,
        ...key,
      };
      for (const listener of keyListeners) listener(fullKey);
    },
    getTerminalSize: () => ({ rows: 24, cols: 80 }),
    write: (data: string) => {
      calls.write++;
      output += data;
    },
    onKey: (handler) => {
      keyListeners.add(handler);
    },
    patchConsole: () => {
      calls.patchConsole++;
      return () => {
        calls.unpatchConsole++;
      };
    },
    setupRawMode: () => {
      calls.setupRawMode++;
    },
    startCapture: () => {
      calls.startCapture++;
    },
    stopCapture: () => {
      calls.stopCapture++;
    },
    clearScreen: () => {
      calls.clearScreen++;
    },
    moveCursor: (row: number, col: number) => {
      calls.moveCursor.push({ row, col });
    },
    cleanupWithoutClear: () => {
      calls.cleanupWithoutClear++;
    },
    disposeSingletonCapture: () => {
      calls.disposeSingletonCapture++;
    },
  };
}

export type MockPlatform = PlatformAdapter & {
  trigger: {
    resize: () => void;
    sigint: () => void;
    sigterm: () => void;
    exit: () => void;
  };
  state: {
    exitCode: number | null;
  };
};

export function createMockPlatform(): MockPlatform {
  let onResize: (() => void) | null = null;
  let onSigint: (() => void) | null = null;
  let onSigterm: (() => void) | null = null;
  let onExit: (() => void) | null = null;

  const state: MockPlatform["state"] = { exitCode: null };

  return {
    state,
    onStdoutResize: (handler) => {
      onResize = handler;
      return () => {
        if (onResize === handler) onResize = null;
      };
    },
    onExit: (handler) => {
      onExit = handler;
    },
    onSigint: (handler) => {
      onSigint = handler;
    },
    onSigterm: (handler) => {
      onSigterm = handler;
    },
    exit: (code) => {
      state.exitCode = code;
    },
    trigger: {
      resize: () => onResize?.(),
      sigint: () => onSigint?.(),
      sigterm: () => onSigterm?.(),
      exit: () => onExit?.(),
    },
  };
}
