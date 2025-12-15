import {
  Block,
  HStack,
  Spacer,
  VStack,
  ZStack,
  Text,
  createApp,
  computed,
  ref,
} from "btuin";

type Page = "Overview" | "Activity" | "Help";

const PAGES: Page[] = ["Overview", "Activity", "Help"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatClock(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(
    d.getSeconds()
  )}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function titleBar(title: string, right?: string) {
  return HStack([
    Text(title).foreground("cyan"),
    Spacer(),
    ...(right ? [Text(right).foreground("gray")] : []),
  ])
    .gap(1)
    .height(1);
}

function card(lines: string[], accent: string) {
  return VStack(lines.map((l) => Text(l)))
    .gap(0)
    .outline({ style: "single", color: accent });
}

const app = createApp({
  init({ onKey, onTick }) {
    const now = ref(new Date());
    const pageIndex = ref(0);
    const paused = ref(false);
    const showOverlay = ref(false);

    const termRows = ref<number>(process.stdout.rows ?? 24);
    const termCols = ref<number>(process.stdout.columns ?? 80);

    const page = computed(
      () => PAGES[clamp(pageIndex.value, 0, PAGES.length - 1)]!
    );
    const clock = computed(() => formatClock(now.value));
    const compact = computed(() => termRows.value < 24 || termCols.value < 80);

    const activity = ref<string[]>([]);
    const activitySeq = ref(0);

    function pushActivity(message: string) {
      const id = activitySeq.value++;
      const line = `${pad2(id % 100)} ${clock.value}  ${message}`;
      const keep = Math.max(10, (process.stdout.rows ?? 24) - 11);
      activity.value = [...activity.value, line].slice(-keep);
    }

    onTick(() => {
      now.value = new Date();

      const nextRows = process.stdout.rows ?? termRows.value;
      const nextCols = process.stdout.columns ?? termCols.value;
      if (nextRows !== termRows.value) termRows.value = nextRows;
      if (nextCols !== termCols.value) termCols.value = nextCols;

      if (!paused.value && now.value.getMilliseconds() < 50) {
        const messages = [
          "Sample Log A",
          "Sample Log B",
          "Sample Log C",
          "Sample Log D",
          "Sample Log E",
        ];
        pushActivity(messages[Math.floor(Math.random() * messages.length)]!);
      }
    }, 50);

    onKey((key) => {
      switch (key.name) {
        case "q":
          process.exit(0);
        case "up":
          pageIndex.value = clamp(pageIndex.value - 1, 0, PAGES.length - 1);
          return true;
        case "down":
          pageIndex.value = clamp(pageIndex.value + 1, 0, PAGES.length - 1);
          return true;
        case " ":
        case "space":
          paused.value = !paused.value;
          pushActivity(
            paused.value ? "Paused activity stream" : "Resumed activity stream"
          );
          return true;
        case "r":
          activity.value = [];
          activitySeq.value = 0;
          pushActivity("Reset activity stream");
          return true;
        case "z":
          termRows.value = process.stdout.rows ?? termRows.value;
          termCols.value = process.stdout.columns ?? termCols.value;
          showOverlay.value = !showOverlay.value;
          pushActivity(
            showOverlay.value
              ? "Opened floating overlay"
              : "Closed floating overlay"
          );
          return true;
      }
    });

    return {
      activity,
      clock,
      compact,
      page,
      pageIndex,
      paused,
      showOverlay,
      termCols,
      termRows,
    };
  },

  render(state) {
    const {
      activity,
      clock,
      compact,
      page,
      pageIndex,
      paused,
      showOverlay,
      termCols,
      termRows,
    } = state;

    const sidebar = () =>
      VStack([
        titleBar("Pages"),
        ...PAGES.map((p, idx) => {
          const active = idx === pageIndex.value;
          const label = active ? `> ${p}` : `  ${p}`;
          return Text(label).foreground(active ? "yellow" : "gray");
        }),
        Block().height(1),
        titleBar("Controls"),
        Text("↑/↓  navigate").foreground("gray"),
        Text("space pause").foreground("gray"),
        Text("r     reset").foreground("gray"),
        Text("z     overlay").foreground("gray"),
        Text("q     quit").foreground("gray"),
      ])
        .gap(0)
        .outline({ style: "single", color: "blue" })
        .width(24)
        .shrink(0);

    const overview = () =>
      VStack([
        titleBar("Overview", clock.value),
        HStack([
          card(
            [
              "Runtime: Bun",
              "Renderer: diff-based",
              `Page: ${page.value}`,
              `Paused: ${paused.value ? "yes" : "no"}`,
            ],
            "magenta"
          ).grow(1),
        ]).gap(2),
        titleBar("Highlights"),
        Text("• Vue-like reactivity (ref/computed/effect)").foreground("gray"),
        Text("• Flexbox-ish layout engine (WASM)").foreground("gray"),
        ...(compact.value
          ? []
          : [Text("• Floating overlay via ZStack").foreground("gray")]),
      ])
        .gap(compact.value ? 0 : 1)
        .outline({ style: "single", color: "green" })
        .grow(1);

    const activityView = () =>
      VStack([
        titleBar("Activity", paused.value ? "paused" : "live"),
        ...activity.value.map((l) => Text(l).foreground("gray")),
      ])
        .gap(0)
        .outline({ style: "single", color: "green" })
        .grow(1);

    const help = () =>
      VStack([
        titleBar("Help", clock.value),
        Text("This is a small showcase app for btuin.").foreground("gray"),
        Text(
          "Try resizing your terminal, then toggle overlay with z."
        ).foreground("gray"),
      ])
        .gap(1)
        .outline({ style: "single", color: "green" })
        .grow(1);

    const main = () => {
      switch (page.value) {
        case "Overview":
          return overview();
        case "Activity":
          return activityView();
        case "Help":
          return help();
      }
    };

    const header = () =>
      HStack([
        Text("btuin").foreground("white"),
        Text("showcase").foreground("gray"),
        Spacer(),
        Text("q:quit").foreground("gray"),
      ])
        .gap(1)
        .outline({ style: "single", color: "blue" });

    const footer = () => {
      const status = paused.value ? "PAUSED" : "LIVE";
      return HStack([
        Text(`[${status}]`).foreground(paused.value ? "yellow" : "green"),
        Text("↑/↓ pages  z overlay  space pause  r reset  q quit").foreground(
          "gray"
        ),
      ])
        .gap(1)
        .outline({ style: "single", color: "blue" });
    };

    const floatingOverlay = () => {
      const maxWidth = Math.max(20, termCols.value - 6);
      const maxHeight = Math.max(7, termRows.value - 8);
      const modalWidth = Math.min(60, maxWidth);
      const modalHeight = Math.min(9, maxHeight);

      const modal = VStack([
        titleBar("Overlay", "z to close"),
        Text("Floating window via ZStack").foreground("gray"),
        Text("This clears its own area (bg).").foreground("gray"),
        ...(modalHeight >= 9
          ? [Block().height(1), Text("Resize and toggle.").foreground("gray")]
          : []),
      ])
        .width(modalWidth)
        .height(modalHeight)
        .background("black")
        .outline({ style: "double", color: "yellow" })
        .justify("flex-start")
        .align("stretch");

      return Block(modal)
        .width("100%")
        .height("100%")
        .justify("center")
        .align("center");
    };

    const baseApp = () =>
      VStack([
        header(),
        HStack([sidebar(), main()]).gap(1).align("stretch").grow(1),
        footer(),
      ])
        .width("100%")
        .justify("flex-start")
        .align("stretch");

    return ZStack([
      baseApp(),
      ...(showOverlay.value ? [floatingOverlay()] : []),
    ])
      .width("100%")
      .height("100%");
  },
});

await app.mount();

const exitAfterMs = Number(process.env.BTUIN_EXIT_AFTER_MS ?? "");
if (Number.isFinite(exitAfterMs) && exitAfterMs > 0) {
  setTimeout(() => process.exit(0), exitAfterMs);
}
