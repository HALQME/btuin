import type { KeyEvent } from "../terminal/types/key-event";
import type { ViewElement } from "../view/types/elements";
import type { FrameMetrics } from "./profiler";
import type { ComputedLayout } from "../layout-engine/types";

export interface AppPlugin {
  name: string;
  handleKey?(event: KeyEvent): boolean;
  wrapView?(root: ViewElement): ViewElement;
  onLayout?(snapshot: {
    size: { rows: number; cols: number };
    rootElement: ViewElement;
    layoutMap: ComputedLayout;
  }): void;
  onProfileFrame?(frame: FrameMetrics): void;
  dispose?(): void;
}

export type AppPluginFactory = (options?: any) => AppPlugin | Promise<AppPlugin>;
