import { runHotReloadProcess } from "@/dev";

runHotReloadProcess({
  command: "bun",
  args: ["examples/devtools.ts"],
  watch: { paths: ["src", "examples"] },
  tcp: {
    host: "127.0.0.1",
    port: 0,
    onListen: ({ host, port }) => {
      process.stderr.write(`[btuin] hot-reload tcp: ${host}:${port}\n`);
      process.stderr.write(`[btuin] trigger: printf 'reload\\n' | nc ${host} ${port}\n`);
    },
  },
});
