import { createApp, VStack, Text, ref, watchEffect } from "../src/index";

const app = createApp({
  init({ onKey, setExitOutput, runtime }) {
    const count = ref(0);
    onKey((k) => {
      if (k.name === "up") count.value++;
      if (k.name === "down") count.value--;
      if (k.name === "q") runtime.exit(0);
    });

    watchEffect(() => {
      setExitOutput(count.value.toString());
    })

    return { count };
  },
  render({ count }) {
    return VStack([Text("Counter"), Text(String(count.value))])
      .width("100%")
      .height("100%")
      .justify("center")
      .align("center");
  },
  profile: {
    hud: true
  }
});

await app.mount();
