import type { AppPlugin, AppPluginFactory } from "../../runtime/plugin";
import type { ConsoleCaptureHandle } from "../../terminal/capture";
import { setupDevtoolsLogStreaming } from "./log-stream";
import type { DevtoolsOptions } from "./types";
import { setupDevtoolsServer, type DevtoolsSnapshot } from "./server";
import type { FrameMetrics } from "../../runtime/profiler";
import { subscribeReactivity } from "../../reactivity/tracker";

const devtoolsPluginFactory: AppPluginFactory = (
  options: DevtoolsOptions | undefined,
): AppPlugin => {
  const enabled = options?.enabled ?? false;

  const streaming = setupDevtoolsLogStreaming(options);

  const capture: ConsoleCaptureHandle | null = enabled ? streaming.capture : null;
  const server = enabled ? setupDevtoolsServer(options, () => capture) : null;
  const cleanupReactivity = enabled
    ? subscribeReactivity((event) => {
        server?.setReactivityEvent(event);
      })
    : null;

  return {
    name: "DevTools",
    handleKey: (event) => {
      void event;
      return false;
    },

    wrapView: (root) => root,

    onLayout: (snapshot) => {
      server?.setSnapshot(snapshot as DevtoolsSnapshot);
    },
    onProfileFrame: (frame: FrameMetrics) => {
      server?.setProfileFrame(frame);
    },

    dispose: () => {
      try {
        cleanupReactivity?.();
      } catch (e) {
        console.error(e);
      }
      try {
        server?.dispose();
      } catch (e) {
        console.error(e);
      }
      streaming.dispose();
    },
  };
};

export default devtoolsPluginFactory;
