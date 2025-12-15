import { describe, it, expect } from "bun:test";
function stripCsi(input: string): string {
  // Strip CSI sequences like: ESC[12;34H, ESC[31m, etc.
  return input.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
}

describe("showcase smoke", () => {
  it("counter renders at least once", async () => {
    const proc = Bun.spawn(["bun", "run", "packages/showcase/counter.ts"], {
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        BTUIN_EXIT_AFTER_MS: "50",
      },
    });

    const [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stripCsi(stdout)).toContain("Counter");
  });

  it("dashboard renders at least once", async () => {
    const proc = Bun.spawn(["bun", "run", "packages/showcase/dashboard.ts"], {
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        BTUIN_EXIT_AFTER_MS: "75",
      },
    });

    const [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    const text = stripCsi(stdout);
    expect(text).toContain("btuin");
    expect(text).toContain("showcase");
  });
});
