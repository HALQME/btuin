import type { ExitReason } from "../components/core";
import type { MountedComponent } from "../components/component";
import type { ReactiveEffect } from "../reactivity/effect";
import type { TerminalAdapter } from "./terminal-adapter";
import type { PlatformAdapter } from "./platform-adapter";
import type { Profiler } from "./profiler";
import type { App, CreateAppOptions, ILoopManager, RenderMode } from "./types";

export type AppContext = {
  app: App;
  state: {
    mounted: MountedComponent | null;
    renderEffect: ReactiveEffect | null;
    isMounted: boolean;
    isUnmounting: boolean;
    disposeResize: (() => void) | null;
    unpatchConsole: (() => void) | null;
    exitHandlers: Set<(info: { code: number; reason: ExitReason }) => void>;
    exitOutput: string | (() => string) | null;
    isExiting: boolean;
    processHasActiveMount: boolean;
    renderMode: RenderMode;
    inlineCleanupOnExit: boolean;
  };
  updaters: {
    mounted: (m: MountedComponent | null) => void;
    renderEffect: (e: ReactiveEffect | null) => void;
    isMounted: (v: boolean) => void;
    isUnmounting: (v: boolean) => void;
    disposeResize: (d: (() => void) | null) => void;
    unpatchConsole: (u: (() => void) | null) => void;
    isExiting: (v: boolean) => void;
    processHasActiveMount: (v: boolean) => void;
    renderMode: (mode: RenderMode) => void;
    inlineCleanupOnExit: (v: boolean) => void;
  };
  terminal: TerminalAdapter;
  platform: PlatformAdapter;
  profiler: Profiler;
  options: CreateAppOptions;
  loopManager: ILoopManager;
};
