import { createApp, enableHotReloadState, ref } from "@/index";
import { Text, VStack } from "@/view";

const app = createApp({
  init({ onKey, onTick, runtime }) {
    const count = ref(0);

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

    return { count };
  },
  render({ count }) {
    return VStack([
      Text("DevTools example").foreground("cyan"),
      Text("DevTools: browser UI (no app code changes)"),
      Text("Run: btuin dev examples/devtools.ts  (auto enables + opens DevTools)"),
      Text("Or:  BTUIN_DEVTOOLS=1 bun examples/devtools.ts"),
      Text("Keys: Up/Down=counter  l=console.log  e=console.error  q=quit"),
      Text(`count: ${count.value}`).foreground("yellow"),
    ])
      .width("100%")
      .height("100%");
  },
});

await app.mount();
