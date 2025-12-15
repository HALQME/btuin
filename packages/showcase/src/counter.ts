import { createApp, HStack, ref, Text, VStack } from "btuin";

const app = createApp({
  init({ onKey }) {
    const count = ref(0);

    onKey((key) => {
      switch (key.name) {
        case "up":
          count.value++;
          break;
        case "down":
          count.value--;
          break;
        case "r":
          count.value = 0;
          break;
        case "q":
          process.exit(0);
      }
    });

    return { count };
  },

  render({ count }) {
    return VStack([
      Text("Counter"),
      HStack([Text("Count: "), Text(`${count.value}`).foreground("red")]),
      Text(count.value.toString()),
    ])
      .outline({ color: "blue" })
      .width("100%")
      .height("100%")
      .justify("center")
      .align("center");
  },
});

await app.mount();

const exitAfterMs = Number(process.env.BTUIN_EXIT_AFTER_MS ?? "");
if (Number.isFinite(exitAfterMs) && exitAfterMs > 0) {
  setTimeout(() => process.exit(0), exitAfterMs);
}
