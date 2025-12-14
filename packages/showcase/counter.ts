import { createApp, HStack, onKey, ref, Text, VStack, type KeyEvent } from "btuin";

const app = createApp({
  setup() {
    const count = ref(0);
    onKey((key: KeyEvent) => {
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

    return () =>
      VStack([
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
