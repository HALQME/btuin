import { createApp, VStack, Text, ref, watchEffect } from "@/index";
import { writeFileSync } from "fs";

export const counterAppConfig: Parameters<typeof createApp>[0] = {
  init({ onKey, setExitOutput, runtime }) {
    const count = ref(0);
    onKey((k) => {
      writeFileSync("/tmp/btuin-debug.log", `key: ${k.name}, count: ${count.value}\n`, {
        flag: "a",
      });
      if (k.name === "up") count.value++;
      if (k.name === "down") count.value--;
      if (k.name === "q") runtime.exit(0);
    });

    watchEffect(() => {
      setExitOutput(count.value.toString());
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
  profile: {
    hud: true,
  },
};

export const app = createApp(counterAppConfig);

if (process.env.NODE_ENV !== "test") {
  await app.mount();
}
