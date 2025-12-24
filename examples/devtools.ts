import { createApp, enableHotReloadState, ref, useLog } from "@/index";
import { Text, VStack } from "@/view";
import { join } from "node:path";
import { tmpdir } from "node:os";

const logFile = join(tmpdir(), "btuin-devtools.log");

const app = createApp({
  devtools: {
    enabled: true,
    maxLogLines: 1000,
    server: {
      host: "127.0.0.1",
      port: 0,
      onListen: ({ url }) => console.log(`[devtools] open ${url}`),
    },
    stream: {
      file: logFile,
      tcp: {
        host: "127.0.0.1",
        port: 9229,
        backlog: 200,
      },
    },
  },
  init({ onKey, onTick, runtime }) {
    const count = ref(0);
    const log = useLog({ maxLines: 200 });

    enableHotReloadState({
      getSnapshot: () => ({ count: count.value }),
      applySnapshot: (snapshot) => {
        if (!snapshot || typeof snapshot !== "object") return;
        const maybe = (snapshot as any).count;
        if (typeof maybe === "number") count.value = maybe;
      },
    });

    onKey((k) => {
      if (k.name === "up") count.value++;
      if (k.name === "down") count.value--;
      if (k.name === "l") console.log(`[app] count=${count.value}`);
      if (k.name === "e") console.error(`[app] error (count=${count.value})`);
      if (k.name === "q") runtime.exit(0);
    });

    onTick(() => {
      // Keep some background noise for tail/stream demos.
      if (count.value % 10 === 0) console.log(`[tick] count=${count.value}`);
    }, 1000);

    return { count, log };
  },
  render({ count, log }) {
    const tail = log.lines.value.slice(-8);
    return VStack([
      Text("DevTools example").foreground("cyan"),
      Text("DevTools: browser UI + log streaming"),
      Text("Keys: Up/Down=counter  l=console.log  e=console.error  q=quit"),
      Text(`File stream: ${logFile}`),
      Text("TCP stream: nc 127.0.0.1 9229 | jq -r '.type + \" \" + .text'"),
      Text(`count: ${count.value}`).foreground("yellow"),
      Text("LogTail (useLog):").foreground("cyan"),
      ...tail.map((line, i) =>
        Text(`${line.type === "stderr" ? "ERR" : "LOG"} ${line.text}`).setKey(`log-tail-${i}`),
      ),
    ])
      .width("100%")
      .height("100%");
  },
});

await app.mount();
