import { createApp, ref } from "@/index";
import { Text, VStack } from "@/view";
import { type KeyEvent } from "@/types";
const app = createApp({
  init: ({ onKey, runtime }) => {
    const progress = ref(0);
    const timer = setInterval(() => {
      progress.value += 1;
    }, 100);
    onKey((k: KeyEvent) => {
      if (k.ctrl && k.name === "c") {
        clearInterval(timer);
        runtime.exit();
      }
      if (k.name === "q") {
        clearInterval(timer);
        runtime.exit();
      }
    });
    return { progress };
  },
  render({ progress }) {
    return VStack([
      Text(`Progress: ${progress.value}%`), //
      Text("Press q to quit"),
    ]).width("100%");
  },
});

app.mount({ inline: true, inlineCleanupOnExit: true });
