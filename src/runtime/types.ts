import type { ComponentInitContext, ExitReason } from "../components/core";
import type { MountedComponent } from "../components/component";
import type { InputParser } from "../terminal/parser/types";
import type { ViewElement } from "../view/types/elements";
import type { TerminalAdapter } from "./terminal-adapter";
import type { PlatformAdapter } from "./platform-adapter";
import type { ProfileOptions } from "./profiler";

export interface ILoopManager {
  start(rows: number, cols: number): void;
  stop(): void;
  cleanupTerminal?(): void;
  /**
   * Optional async preparation step (used by dev tooling to initialize
   * sidecar servers before the TUI begins rendering).
   */
  prepare?(): Promise<void>;
}

export type RenderMode = "fullscreen" | "inline";

export type AppConfig<State> = {
  platform?: Partial<PlatformAdapter>;
  terminal?: TerminalAdapter;
  onError?: (error: Error, phase: string) => void;
  errorLog?: string;
  onExit?: () => void;
  profile?: ProfileOptions;
  inputParser?: InputParser;
  /**
   * Internal/optional: dev runners may set this (e.g. via env) to enable extra tooling.
   * The core runtime treats it as opaque.
   */
  devtools?: unknown;
  init: (ctx: ComponentInitContext) => State;
  render: (state: State) => ViewElement;
};

export interface App {
  mount(options?: MountOptions): Promise<void>;
  unmount(): void;
  exit(code?: number, reason?: ExitReason): void;
  getSize(): { rows: number; cols: number };
  onResize(handler: () => void): () => void;
  getEnv(name: string): string | undefined;
  onExit(handler: (info: { code: number; reason: ExitReason }) => void): () => void;
  setExitOutput(output: string | (() => string)): void;
  getComponent(): MountedComponent | null;
}

export interface MountOptions {
  rows?: number;
  cols?: number;
  inline?: boolean;
  inlineCleanupOnExit?: boolean;
}

export type CreateAppOptions = {
  onError?: (error: Error, phase: string) => void;
  errorLog?: string;
  onExit?: () => void;
  terminal?: TerminalAdapter;
  platform?: PlatformAdapter;
  profile?: ProfileOptions;
  inputParser?: InputParser;
  /**
   * Internal/optional: dev runners may set this (e.g. via env) to enable extra tooling.
   * The core runtime treats it as opaque.
   */
  devtools?: unknown;
};
