import { createApp, ref } from "@/index";
import { Text, VStack } from "@/view";

const app = createApp({
  init({ onKey, setExitOutput, runtime }) {
    const count = ref(0);
    onKey((k) => {
      setExitOutput(count.value.toString());
      if (k.name === "up") count.value++;
      if (k.name === "down") count.value--;
      if (k.name === "q") runtime.exit(0);
    });

    return { count };
  },
  render({ count }) {
    return VStack([
      Text("Counter"), //
      Text(String(count.value)),
    ])
      .width("100%")
      .height("100%")
      .justify("center")
      .align("center");
  },
});

await app.mount();
