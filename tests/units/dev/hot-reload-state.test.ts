import { describe, expect, it } from "bun:test";
import { enableHotReloadState } from "@/dev";

describe("hot reload state", () => {
  it("should apply env snapshot and respond to IPC snapshot request", () => {
    const snapshot = { count: 123 };
    process.env.BTUIN_HOT_RELOAD_SNAPSHOT = Buffer.from(JSON.stringify(snapshot), "utf8").toString(
      "base64",
    );

    const sent: any[] = [];
    (process as any).send = (msg: any) => {
      sent.push(msg);
    };

    let applied: unknown = null;
    enableHotReloadState({
      getSnapshot: () => ({ ok: true }),
      applySnapshot: (s) => {
        applied = s;
      },
    });

    expect(applied).toEqual(snapshot);

    process.emit("message", { type: "btuin:hot-reload:request-snapshot" });
    expect(sent).toContainEqual({ type: "btuin:hot-reload:snapshot", snapshot: { ok: true } });
  });
});
