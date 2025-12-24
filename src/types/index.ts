export type { Component, ComponentDefinition, ComponentInitContext } from "../components/core";
export type { ExitReason, KeyHandler, RuntimeContext, TickHandler } from "../components/core";
export type {
  DefineComponentOptions,
  MountedComponent,
  PropsOptions,
} from "../components/component";
export type { PropDefinition, RenderFunction } from "../components/component";
export type { KeyEventHook, LifecycleHook, TickHook } from "../components/lifecycle";

export type { LayoutContainerSize, LayoutEngine, LayoutOptions } from "../layout/types";
export type {
  ComputedLayout,
  Dimension,
  LayoutInputNode,
  LayoutStyle,
  Rect,
} from "../layout-engine/types";

export type {
  App as AppType,
  AppConfig,
  CreateAppOptions,
  ILoopManager,
  MountOptions,
  RenderMode,
} from "../runtime/types";
export type { PlatformAdapter } from "../runtime/platform-adapter";
export type { TerminalAdapter } from "../runtime/terminal-adapter";
export type { FrameMetrics, ProfileOptions, ProfileOutput } from "../runtime/profiler";
export type * from "../hooks/types";

export type { Buffer2D, ColorValue, OutlineOptions } from "../renderer/types";

export type { InputParser } from "../terminal/parser/types";
export type { KeyEvent, KeyHandler as TerminalKeyHandler } from "../terminal/types/key-event";
export type { ConsoleLine } from "../terminal/capture";

export type { BaseView, ViewProps } from "../view/base";
export type { FocusContext, FocusHandler, FocusTarget } from "../view/types/focus";
export type { BlockView, InputView, TextView, ViewElement } from "../view/types/elements";
export type { BlockElement } from "../view/primitives/block";
