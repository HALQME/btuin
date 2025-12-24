import type { ServerWebSocket } from "bun";
import type { ComputedLayout } from "../layout-engine/types";
import type { ConsoleCaptureHandle, ConsoleLine } from "../terminal/capture";
import { isBlock, isText, type ViewElement } from "../view/types/elements";
import type { DevtoolsOptions } from "./types";

export interface DevtoolsSnapshot {
  size: { rows: number; cols: number };
  rootElement: ViewElement;
  layoutMap: ComputedLayout;
}

type LayoutBox = { x: number; y: number; width: number; height: number };

type ViewNode = {
  key: string;
  type: string;
  text?: string;
  children?: ViewNode[];
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
  dispose(): void;
}

function getKey(el: ViewElement): string {
  return (el.key ?? el.identifier ?? "") as string;
}

function serializeViewTree(root: ViewElement): { tree: ViewNode; keys: Set<string> } {
  const keys = new Set<string>();

  const walk = (el: ViewElement): ViewNode => {
    const key = getKey(el);
    keys.add(key);

    if (isText(el)) {
      return { key, type: el.type, text: el.content };
    }

    if (isBlock(el)) {
      return {
        key,
        type: el.type,
        children: el.children.map(walk),
      };
    }

    return { key, type: el.type };
  };

  return { tree: walk(root), keys };
}

function buildBrowserSnapshot(snapshot: DevtoolsSnapshot): BrowserSnapshot {
  const { tree, keys } = serializeViewTree(snapshot.rootElement);
  const layout: Record<string, LayoutBox> = {};

  for (const key of keys) {
    const entry = snapshot.layoutMap[key];
    if (!entry) continue;
    layout[key] = { x: entry.x, y: entry.y, width: entry.width, height: entry.height };
  }

  return {
    timestamp: Date.now(),
    size: snapshot.size,
    tree,
    layout,
  };
}

function htmlDocument(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>btuin DevTools</title>
    <style>
      :root { color-scheme: dark; }
      body { margin: 0; font-family: ui-sans-serif, system-ui; background: #0b0f14; color: #e6edf3; }
      header { display: flex; gap: 12px; align-items: center; padding: 10px 12px; border-bottom: 1px solid #1f2937; }
      .pill { font-size: 12px; padding: 2px 8px; border: 1px solid #334155; border-radius: 999px; color: #cbd5e1; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; height: calc(100vh - 44px); }
      section { padding: 12px; overflow: auto; }
      h2 { font-size: 13px; font-weight: 600; color: #93c5fd; margin: 0 0 10px; }
      pre { margin: 0; font-size: 12px; line-height: 1.3; white-space: pre-wrap; word-break: break-word; }
      .logline { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; padding: 2px 0; border-bottom: 1px dashed #1f2937; }
      .stderr { color: #fca5a5; }
      .stdout { color: #e5e7eb; }
      button { background: #111827; color: #e5e7eb; border: 1px solid #334155; padding: 6px 10px; border-radius: 8px; cursor: pointer; }
      button:hover { background: #0b1220; }
      button[aria-pressed="true"] { border-color: #93c5fd; }
      a { color: #93c5fd; text-decoration: none; }
      a:hover { text-decoration: underline; }
      .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      .tabs { display: flex; gap: 8px; align-items: center; }
      .controls { display: flex; gap: 12px; align-items: center; font-size: 12px; color: #cbd5e1; margin-bottom: 10px; }
      .controls label { display: inline-flex; gap: 6px; align-items: center; }
      input[type="range"] { width: 120px; }
      #previewScroll {
        --cellw: 9px;
        --cellh: 18px;
        border: 1px solid #1f2937;
        border-radius: 10px;
        background-color: #0b0f14;
        background-image:
          linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(148,163,184,0.08) 1px, transparent 1px);
        background-size: var(--cellw) var(--cellh);
        overflow: auto;
        height: calc(100% - 64px);
        min-height: 220px;
      }
      #previewStage { position: relative; }
      .node {
        position: absolute;
        box-sizing: border-box;
        border: 1px solid rgba(59,130,246,0.35);
        background: rgba(15,23,42,0.20);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
        line-height: 1.25;
        color: #e5e7eb;
        padding: 2px 3px;
        white-space: pre;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .node:hover { outline: 2px solid rgba(147,197,253,0.85); outline-offset: 0px; }
    </style>
  </head>
  <body>
    <header>
      <div style="font-weight:600">btuin DevTools</div>
      <span id="status" class="pill">connecting…</span>
      <button id="snapshot">Request snapshot</button>
      <span class="pill">WS: <span id="wsurl"></span></span>
    </header>
    <div class="grid">
      <section>
        <div class="row" style="margin-bottom:10px">
          <h2 style="margin:0">Snapshot</h2>
          <div class="tabs">
            <button id="tabPreview" aria-pressed="true">Preview</button>
            <button id="tabJson" aria-pressed="false">JSON</button>
          </div>
        </div>
        <div id="previewPanel">
          <div class="controls">
            <label>Zoom <input id="zoom" type="range" min="60" max="200" value="100" /></label>
            <label><input id="boxes" type="checkbox" checked /> Boxes</label>
            <span id="previewSize" class="pill">(none)</span>
          </div>
          <div id="previewScroll"><div id="previewStage"></div></div>
        </div>
        <pre id="snapshotView" style="display:none">(none)</pre>
      </section>
      <section>
        <h2>Logs</h2>
        <div id="logs"></div>
      </section>
    </div>
    <script>
      const wsUrl = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws";
      document.getElementById("wsurl").textContent = wsUrl;
      const statusEl = document.getElementById("status");
      const logsEl = document.getElementById("logs");
      const snapshotEl = document.getElementById("snapshotView");
      const btn = document.getElementById("snapshot");
      const tabPreview = document.getElementById("tabPreview");
      const tabJson = document.getElementById("tabJson");
      const previewPanel = document.getElementById("previewPanel");
      const previewScroll = document.getElementById("previewScroll");
      const previewStage = document.getElementById("previewStage");
      const previewSize = document.getElementById("previewSize");
      const zoomEl = document.getElementById("zoom");
      const boxesEl = document.getElementById("boxes");

      let latestSnapshot = null;
      let showBoxes = true;
      let scale = 1;
      let cellW = 9;
      let cellH = 18;

      const socket = new WebSocket(wsUrl);
      socket.addEventListener("open", () => {
        statusEl.textContent = "connected";
      });
      socket.addEventListener("close", () => {
        statusEl.textContent = "disconnected";
      });
      socket.addEventListener("error", () => {
        statusEl.textContent = "error";
      });

      btn.addEventListener("click", () => {
        try { socket.send(JSON.stringify({ type: "requestSnapshot" })); } catch {}
      });

      function setTab(tab) {
        const preview = tab === "preview";
        tabPreview.setAttribute("aria-pressed", preview ? "true" : "false");
        tabJson.setAttribute("aria-pressed", preview ? "false" : "true");
        previewPanel.style.display = preview ? "block" : "none";
        snapshotEl.style.display = preview ? "none" : "block";
      }

      tabPreview.addEventListener("click", () => setTab("preview"));
      tabJson.addEventListener("click", () => setTab("json"));

      function flattenTree(root) {
        const out = [];
        const walk = (node, depth) => {
          out.push({ node, depth });
          if (node && node.children && Array.isArray(node.children)) {
            for (const child of node.children) walk(child, depth + 1);
          }
        };
        walk(root, 0);
        return out;
      }

      function renderPreview(snapshot) {
        previewStage.textContent = "";
        if (!snapshot) {
          previewSize.textContent = "(none)";
          return;
        }
        const rows = snapshot.size?.rows ?? 0;
        const cols = snapshot.size?.cols ?? 0;
        previewSize.textContent = cols + "x" + rows;

        previewScroll.style.setProperty("--cellw", cellW + "px");
        previewScroll.style.setProperty("--cellh", cellH + "px");

        previewStage.style.width = (cols * cellW) + "px";
        previewStage.style.height = (rows * cellH) + "px";

        const frag = document.createDocumentFragment();
        const items = flattenTree(snapshot.tree);
        for (const item of items) {
          const node = item.node;
          const box = snapshot.layout && node && node.key ? snapshot.layout[node.key] : null;
          if (!box) continue;

          const el = document.createElement("div");
          el.className = "node";
          el.style.left = (box.x * cellW) + "px";
          el.style.top = (box.y * cellH) + "px";
          el.style.width = (box.width * cellW) + "px";
          el.style.height = (box.height * cellH) + "px";
          el.style.zIndex = String(item.depth + 1);
          if (!showBoxes) el.style.border = "none";
          if (typeof node.text === "string") el.textContent = node.text;
          el.title = (node.type || "node") + " key=" + (node.key || "(none)") + " (" + box.x + "," + box.y + ") " + box.width + "x" + box.height;
          frag.appendChild(el);
        }
        previewStage.appendChild(frag);
      }

      function applyZoom() {
        scale = Math.max(0.6, Math.min(2, Number(zoomEl.value) / 100));
        cellW = Math.round(9 * scale);
        cellH = Math.round(18 * scale);
        renderPreview(latestSnapshot);
      }

      zoomEl.addEventListener("input", applyZoom);
      boxesEl.addEventListener("change", () => {
        showBoxes = !!boxesEl.checked;
        renderPreview(latestSnapshot);
      });

      function appendLog(line) {
        const div = document.createElement("div");
        div.className = "logline " + (line.type === "stderr" ? "stderr" : "stdout");
        const ts = new Date(line.timestamp).toISOString().slice(11, 19);
        div.textContent = "[" + ts + "] " + line.text;
        logsEl.appendChild(div);
        const max = 400;
        while (logsEl.childNodes.length > max) logsEl.removeChild(logsEl.firstChild);
        logsEl.scrollTop = logsEl.scrollHeight;
      }

      socket.addEventListener("message", (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (!msg || typeof msg !== "object") return;
        if (msg.type === "log" && msg.line) appendLog(msg.line);
        if (msg.type === "logs" && Array.isArray(msg.lines)) msg.lines.forEach(appendLog);
        if (msg.type === "snapshot" && msg.snapshot) {
          latestSnapshot = msg.snapshot;
          snapshotEl.textContent = JSON.stringify(msg.snapshot, null, 2);
          renderPreview(latestSnapshot);
        }
      });

      setTab("preview");
      applyZoom();
    </script>
  </body>
</html>`;
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
  let info: { host: string; port: number; url: string } | null = null;

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
          return new Response(htmlDocument(), {
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
      info = null;
    },
  };
}
