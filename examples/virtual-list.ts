import { createApp, ref } from "@/index";
import { Text, VStack, Windowed, clampWindowedStartIndex, getWindowedMetrics } from "@/view";

const TOTAL = 50_000;
const items = Array.from({ length: TOTAL }, (_, i) => `item ${i}`);

const app = createApp({
  init({ onKey, runtime }) {
    const scrollIndex = ref(0);

    onKey((k) => {
      if (k.name === "q") runtime.exit(0);
      if (k.name === "down")
        scrollIndex.value = clampWindowedStartIndex({
          itemCount: items.length,
          startIndex: scrollIndex.value + 1,
        });
      if (k.name === "up")
        scrollIndex.value = clampWindowedStartIndex({
          itemCount: items.length,
          startIndex: scrollIndex.value - 1,
        });
      if (k.name === "pagedown")
        scrollIndex.value = clampWindowedStartIndex({
          itemCount: items.length,
          startIndex: scrollIndex.value + 20,
        });
      if (k.name === "pageup")
        scrollIndex.value = clampWindowedStartIndex({
          itemCount: items.length,
          startIndex: scrollIndex.value - 20,
        });
    });

    return { scrollIndex };
  },
  render({ scrollIndex }) {
    // Reserve 2 rows for header+status and 2 rows for outline padding (1 top + 1 bottom).
    const header = Text(`Windowed: ${items.length} items (q to quit)`).foreground("cyan").shrink(0);
    const clamped = getWindowedMetrics({
      itemCount: items.length,
      startIndex: scrollIndex.value,
    }).startIndex;
    const status = Text(`startIndex=${clamped}`).foreground("gray").shrink(0);

    const list = Windowed({
      items,
      startIndex: clamped,
      itemHeight: 1,
      overscan: 2,
      keyPrefix: "windowed",
      renderItem: (item) => Text(item),
    });

    return VStack([header, status, list]).width("100%").outline({ style: "single", color: "blue" });
  },
});

await app.mount();
