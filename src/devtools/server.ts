import type { ServerWebSocket } from "bun";
import type { ComputedLayout, LayoutStyle } from "../layout-engine/types";
import type { OutlineOptions } from "../renderer/types";
import type { ConsoleCaptureHandle, ConsoleLine } from "../terminal/capture";
import type { FrameMetrics } from "../runtime/profiler";
import type { ReactivityEvent } from "../reactivity/devtools";
import { isBlock, isText, type ViewElement } from "../view/types/elements";
import type { DevtoolsOptions } from "./types";
import htmlDocument from "./inspector.html" with { type: "text" };

export interface DevtoolsSnapshot {
  size: { rows: number; cols: number };
  rootElement: ViewElement;
  layoutMap: ComputedLayout;
}

type LayoutBox = { x: number; y: number; width: number; height: number };

type LayoutStyleKey =
  | "display"
  | "position"
  | "width"
  | "height"
  | "minWidth"
  | "minHeight"
  | "maxWidth"
  | "maxHeight"
  | "layoutBoundary"
  | "padding"
  | "margin"
  | "flexDirection"
  | "flexWrap"
  | "flexGrow"
  | "flexShrink"
  | "flexBasis"
  | "justifyContent"
  | "alignItems"
  | "alignSelf"
  | "gap";

const layoutStyleKeys: readonly LayoutStyleKey[] = [
  "display",
  "position",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "layoutBoundary",
  "padding",
  "margin",
  "flexDirection",
  "flexWrap",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "justifyContent",
  "alignItems",
  "alignSelf",
  "gap",
] as const;
type LayoutStyleInfo = Partial<Pick<LayoutStyle, LayoutStyleKey>>;

type ViewStyleInfo = {
  foreground?: string | number;
  background?: string | number;
  outline?: Pick<OutlineOptions, "color" | "style" | "title">;
  stack?: "z";
};

type ViewNode = {
  key: string;
  type: string;
  text?: string;
  children?: ViewNode[];
  layoutStyle?: LayoutStyleInfo;
  viewStyle?: ViewStyleInfo;
};

type BrowserSnapshot = {
  timestamp: number;
  size: { rows: number; cols: number };
  tree: ViewNode;
  layout: Record<string, LayoutBox>;
};

export interface DevtoolsServerHandle {
  getInfo(): { host: string; port: number; url: string } | null;
  setSnapshot(snapshot: DevtoolsSnapshot): void;
  setProfileFrame(frame: FrameMetrics): void;
  setReactivityEvent(event: ReactivityEvent): void;
  dispose(): void;
}

function getKey(el: ViewElement): string {
  return (el.key ?? el.identifier ?? "") as string;
}

function pickLayoutStyle(style: ViewElement["style"] | undefined): LayoutStyleInfo | undefined {
  if (!style) return undefined;
  const out: LayoutStyleInfo = {};
  for (const key of layoutStyleKeys) {
    if (style[key] !== undefined) {
      (out as any)[key] = style[key];
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function pickViewStyle(style: ViewElement["style"] | undefined): ViewStyleInfo | undefined {
  if (!style) return undefined;
  const out: ViewStyleInfo = {};

  if (style.foreground !== undefined) out.foreground = style.foreground;
  if (style.background !== undefined) out.background = style.background;
  if (style.stack !== undefined) out.stack = style.stack;

  if (style.outline) {
    const { color, style: outlineStyle, title } = style.outline;
    out.outline = { color, style: outlineStyle, title };
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

function buildBrowserSnapshot(snapshot: DevtoolsSnapshot): BrowserSnapshot {
  const layout: Record<string, LayoutBox> = {};

  const walk = (el: ViewElement, parentX: number, parentY: number): ViewNode => {
    const key = getKey(el);
    const entry = snapshot.layoutMap[key];
    const absX = (entry?.x ?? 0) + parentX;
    const absY = (entry?.y ?? 0) + parentY;
    const width = entry?.width ?? 0;
    const height = entry?.height ?? 0;
    if (entry) {
      layout[key] = { x: absX, y: absY, width, height };
    }

    const layoutStyle = pickLayoutStyle(el.style);
    const viewStyle = pickViewStyle(el.style);

    if (isText(el)) {
      return { key, type: el.type, text: el.content, layoutStyle, viewStyle };
    }

    if (isBlock(el)) {
      return {
        key,
        type: el.type,
        layoutStyle,
        viewStyle,
        children: el.children.map((child) => walk(child, absX, absY)),
      };
    }

    return { key, type: el.type, layoutStyle, viewStyle };
  };

  const tree = walk(snapshot.rootElement, 0, 0);

  return {
    timestamp: Date.now(),
    size: snapshot.size,
    tree,
    layout,
  };
}

function safeJson(payload: any): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return JSON.stringify({ type: "error", message: "failed to serialize payload" });
  }
}

export function setupDevtoolsServer(
  options: DevtoolsOptions | undefined,
  getCapture: () => ConsoleCaptureHandle | null,
): DevtoolsServerHandle | null {
  const cfg = options?.server;
  if (!cfg) return null;

  const host = cfg.host ?? "127.0.0.1";
  const port = cfg.port ?? 0;

  const clients = new Set<ServerWebSocket<{ id: number }>>();
  let nextClientId = 1;
  let cleanupSubscribe: (() => void) | null = null;
  let snapshot: BrowserSnapshot | null = null;
  let profileFrames: FrameMetrics[] = [];
  let reactivityEvents: ReactivityEvent[] = [];
  let info: { host: string; port: number; url: string } | null = null;
  const maxProfileFrames = 240;
  const maxReactivityEvents = 600;

  let server: ReturnType<typeof Bun.serve> | null = null;
  try {
    server = Bun.serve<{ id: number }>({
      hostname: host,
      port,
      fetch(req, s) {
        const url = new URL(req.url);
        if (url.pathname === "/ws") {
          const ok = s.upgrade(req, { data: { id: nextClientId++ } });
          return ok ? undefined : new Response("upgrade failed", { status: 400 });
        }
        if (url.pathname === "/" || url.pathname === "/index.html") {
          return new Response(`${htmlDocument}`, {
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
        return new Response("not found", { status: 404 });
      },
      websocket: {
        open(ws) {
          clients.add(ws);

          const capture = getCapture();
          if (capture) {
            try {
              ws.send(
                safeJson({
                  type: "logs",
                  lines: capture.getLines(),
                }),
              );
            } catch {
              // ignore
            }
          }
          if (snapshot) {
            try {
              ws.send(safeJson({ type: "snapshot", snapshot }));
            } catch {
              // ignore
            }
          }
          if (profileFrames.length > 0) {
            try {
              ws.send(safeJson({ type: "profile", frames: profileFrames }));
            } catch {
              // ignore
            }
          }
          if (reactivityEvents.length > 0) {
            try {
              ws.send(safeJson({ type: "reactivity", events: reactivityEvents }));
            } catch {
              // ignore
            }
          }
        },
        close(ws) {
          clients.delete(ws);
        },
        message(ws, message) {
          const text = typeof message === "string" ? message : new TextDecoder().decode(message);
          let msg: any = null;
          try {
            msg = JSON.parse(text);
          } catch {
            return;
          }
          if (!msg || typeof msg !== "object") return;
          if (msg.type === "requestSnapshot" && snapshot) {
            try {
              ws.send(safeJson({ type: "snapshot", snapshot }));
            } catch {
              // ignore
            }
          }
        },
      },
    });

    const resolvedHost = server.hostname ?? host;
    const resolvedPort = server.port ?? port;
    const url = `http://${resolvedHost}:${resolvedPort}`;
    info = { host: resolvedHost, port: resolvedPort, url };
    try {
      cfg.onListen?.(info);
    } catch {
      // ignore
    }
  } catch {
    // ignore server errors to avoid crashing the app
    server = null;
  }

  const broadcast = (payload: any) => {
    if (clients.size === 0) return;
    const text = safeJson(payload);
    for (const ws of clients) {
      try {
        ws.send(text);
      } catch {
        try {
          ws.close();
        } catch {
          // ignore
        }
        clients.delete(ws);
      }
    }
  };

  const ensureSubscribed = () => {
    if (cleanupSubscribe) return;
    const capture = getCapture();
    if (!capture) return;
    cleanupSubscribe = capture.subscribe((line: ConsoleLine) => {
      broadcast({ type: "log", line });
    });
  };

  ensureSubscribed();

  return {
    getInfo: () => info,
    setSnapshot: (s) => {
      snapshot = buildBrowserSnapshot(s);
      broadcast({ type: "snapshot", snapshot });
      ensureSubscribed();
    },
    setProfileFrame: (frame) => {
      profileFrames.push(frame);
      if (profileFrames.length > maxProfileFrames) {
        profileFrames.splice(0, profileFrames.length - maxProfileFrames);
      }
      broadcast({ type: "profile", frame });
    },
    setReactivityEvent: (event) => {
      reactivityEvents.push(event);
      if (reactivityEvents.length > maxReactivityEvents) {
        reactivityEvents.splice(0, reactivityEvents.length - maxReactivityEvents);
      }
      broadcast({ type: "reactivity", event });
    },
    dispose: () => {
      try {
        cleanupSubscribe?.();
      } catch {
        // ignore
      }
      cleanupSubscribe = null;

      for (const ws of clients) {
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
      clients.clear();

      try {
        server?.stop(true);
      } catch {
        // ignore
      }
      server = null;
      snapshot = null;
      profileFrames = [];
      reactivityEvents = [];
      info = null;
    },
  };
}
