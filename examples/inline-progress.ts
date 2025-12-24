import { createApp, ref } from "@/index";
import { Text, VStack } from "@/view";

const app = createApp({
  init({ onKey, onTick, runtime, setExitOutput }) {
    const progress = ref(0);

    onKey((k) => {
      if (k.name === "q") runtime.exit(0);
    });

    onTick(() => {
      progress.value = Math.min(100, progress.value + 1);
      setExitOutput(`canceled (${progress.value}%)`);
      if (progress.value >= 100) {
        setExitOutput("done.");
        runtime.exit(0);
      }
    }, 25);

    return { progress };
  },
  render({ progress }) {
    return VStack([
      Text(`Progress: ${progress.value}%`), //
      Text("Press q to quit"),
    ]).width("100%");
  },
});

await app.mount({ inline: true, inlineCleanupOnExit: true });
