import type { ComponentInitContext, ExitReason } from "@/components/core";
import type { MountedComponent } from "@/components";
import type { TerminalAdapter } from "./terminal-adapter";
import type { PlatformAdapter } from "./platform-adapter";
import type { ProfileOptions } from "./profiler";
import type { InputParser } from "@/terminal/parser/types";
import type { ViewElement } from "@/view/types/elements";

export interface ILoopManager {
  start(rows: number, cols: number): void;
  stop(): void;
}

export type AppConfig<State> = {
  platform?: Partial<PlatformAdapter>;
  terminal?: TerminalAdapter;
  onError?: (error: Error, phase: string) => void;
  errorLog?: string;
  onExit?: () => void;
  profile?: ProfileOptions;
  inputParser?: InputParser;
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
}

export type CreateAppOptions = {
  onError?: (error: Error, phase: string) => void;
  errorLog?: string;
  onExit?: () => void;
  terminal?: TerminalAdapter;
  platform?: PlatformAdapter;
  profile?: ProfileOptions;
  inputParser?: InputParser;
};
