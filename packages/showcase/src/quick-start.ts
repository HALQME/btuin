import { createApp, ref, onKey, Paragraph, VStack, type KeyEvent } from "btuin";

const app = createApp({
  setup() {
    const count = ref(0);

    onKey((key: KeyEvent) => {
      if (key.name === "up") count.value++;
      if (key.name === "down") count.value--;
      if (key.name === "q") process.exit(0);
    });

    return () =>
      VStack({
        children: [
          Paragraph({
            text: "btuin Counter App",
            align: "center",
            color: "magenta",
          }),
          Paragraph({ text: `Current Count: ${count.value}`, align: "center" }),
          Paragraph({ text: "[Up/Down] to change, [q] to quit", color: "gray" }),
        ],
      });
  },
});

app.mount();
