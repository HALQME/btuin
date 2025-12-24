import { describe, expect, it } from "bun:test";
import { parseBtuinCliArgs } from "@/cli";

describe("btuin cli args", () => {
  it("should default to help", () => {
    expect(parseBtuinCliArgs([])).toEqual({ kind: "help" });
  });

  it("should parse dev entry and passthrough args", () => {
    const parsed = parseBtuinCliArgs(["dev", "examples/devtools.ts", "--", "--foo", "bar"]);
    expect(parsed.kind).toBe("dev");
    if (parsed.kind !== "dev") return;
    expect(parsed.entry).toBe("examples/devtools.ts");
    expect(parsed.childArgs).toEqual(["--foo", "bar"]);
    expect(parsed.tcp.enabled).toBe(true);
  });

  it("should parse watch and tcp options", () => {
    const parsed = parseBtuinCliArgs([
      "dev",
      "src/main.ts",
      "--watch",
      "src",
      "--watch",
      "examples",
      "--debounce",
      "123",
      "--tcp-host",
      "0.0.0.0",
      "--tcp-port",
      "9229",
    ]);
    expect(parsed.kind).toBe("dev");
    if (parsed.kind !== "dev") return;
    expect(parsed.watch).toEqual(["src", "examples"]);
    expect(parsed.debounceMs).toBe(123);
    expect(parsed.tcp).toEqual({ enabled: true, host: "0.0.0.0", port: 9229 });
  });

  it("should disable tcp", () => {
    const parsed = parseBtuinCliArgs(["dev", "src/main.ts", "--no-tcp"]);
    expect(parsed.kind).toBe("dev");
    if (parsed.kind !== "dev") return;
    expect(parsed.tcp).toEqual({ enabled: false });
  });

  // preserve-state support intentionally removed
});
