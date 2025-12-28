import { createApp, ref } from "@/index";
import { type KeyEvent } from "@/types";
import { Text, VStack } from "@/view";

const app = createApp({
  profile: { enabled: true },
  init({ onKey, setExitOutput, runtime }) {
    const count = ref(0);
    onKey((k: KeyEvent) => {
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
      Text({
        value: String(count.value),
        semantics: {
          role: "status",
          valueNow: count.value,
          valueText: `The current count is ${count.value}`,
        },
      }),
    ])
      .width("100%")
      .height("100%")
      .justify("center")
      .align("center");
  },
});

await app.mount();
