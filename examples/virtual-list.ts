import { createApp, ref } from "@/index";
import { Text, VStack, Windowed } from "@/view";

const TOTAL = 50_000;
const items = Array.from({ length: TOTAL }, (_, i) => `item ${i}`);

const app = createApp({
  init({ onKey, onResize, runtime }) {
    const scrollIndex = ref(0);
    const size = ref(runtime.getSize());

    onResize(() => {
      size.value = runtime.getSize();
    });

    const clamp = (value: number) => {
      const viewportRows = Math.max(0, size.value.rows - 4);
      const maxScroll = Math.max(0, items.length - viewportRows);
      return Math.max(0, Math.min(maxScroll, value));
    };

    onKey((k) => {
      if (k.name === "q") runtime.exit(0);
      if (k.name === "down") scrollIndex.value = clamp(scrollIndex.value + 1);
      if (k.name === "up") scrollIndex.value = clamp(scrollIndex.value - 1);
      if (k.name === "pagedown") scrollIndex.value = clamp(scrollIndex.value + 20);
      if (k.name === "pageup") scrollIndex.value = clamp(scrollIndex.value - 20);
    });

    return { scrollIndex, size };
  },
  render({ scrollIndex, size }) {
    // Reserve 2 rows for header+status and 2 rows for outline padding (1 top + 1 bottom).
    const viewportRows = Math.max(0, size.value.rows - 4);
    const header = Text(`Windowed: ${items.length} items (q to quit)`).foreground("cyan").shrink(0);
    const status = Text(`startIndex=${scrollIndex.value}`).foreground("gray").shrink(0);

    const list = Windowed({
      items,
      startIndex: scrollIndex.value,
      viewportRows,
      itemHeight: 1,
      overscan: 2,
      keyPrefix: "windowed",
      renderItem: (item) => Text(item),
    });

    return VStack([header, status, list]).width("100%").outline({ style: "single", color: "blue" });
  },
});

await app.mount();
