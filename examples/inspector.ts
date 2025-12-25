import { createApp, ref } from "@/index";
import { truncateTextWidth, wrapTextWidth } from "@/renderer";
import { HStack, Text, VStack, ZStack } from "@/view";
import { Block } from "@/view/primitives";

const BOX_W = 24;
const LOG_LIMIT = 18;

function OutlineBox(
  title: string,
  children: Parameters<typeof VStack>[0],
  width?: number | string,
) {
  const box = VStack(children).outline({ color: 243, style: "single", title });
  if (width !== undefined) box.width(width);
  return box;
}

function Toggle(label: string, active: boolean) {
  const el = Text(` ${label} `);
  if (active) {
    el.background(236).foreground(231);
  }
  return Block(el);
}

function TextBox({
  title,
  content,
  width,
  wrap,
  fg,
  bg,
  outlineStyle,
}: {
  title: string;
  content: string;
  width: number;
  wrap: boolean;
  fg?: string | number;
  bg?: string | number;
  outlineStyle?: "single" | "double";
}) {
  const innerW = Math.max(1, width - 2);
  const lines = wrap ? wrapTextWidth(content, innerW) : [truncateTextWidth(content, innerW)];

  const header = Text(title).foreground("cyan");
  const body = VStack(lines.map((line) => Text(line)));

  const box = VStack([header, body])
    .width(width)
    .padding(0)
    .foreground(fg ?? 253)
    .outline({
      color: 244,
      style: outlineStyle ?? "single",
      title,
    });
  if (bg !== undefined) {
    box.background(bg);
  }
  return box;
}

function Tag(label: string, bg: number, fg = 16) {
  const el = Text(` ${label} `).background(bg).foreground(fg);
  el.setKey(`tag:${label}`);
  return el;
}

const app = createApp({
  profile: { enabled: true },
  init({ onKey, onTick, runtime }) {
    const counter = ref(0);
    const selected = ref<"layout" | "style" | "text">("layout");
    const sidebarWide = ref(true);
    const logs = ref<string[]>([]);

    const addLog = (line: string) => {
      const next = logs.value.slice(-LOG_LIMIT + 1);
      next.push(line);
      logs.value = next;
    };

    onKey((k) => {
      if (k.name === "up") counter.value++;
      if (k.name === "down") counter.value--;
      if (k.name === "1") selected.value = "layout";
      if (k.name === "2") selected.value = "style";
      if (k.name === "3") selected.value = "text";
      if (k.name === "s") sidebarWide.value = !sidebarWide.value;
      if (k.name === "l") {
        const msg = `[ログ] counter=${counter.value}`;
        addLog(msg);
        console.log(msg);
      }
      if (k.name === "e") {
        const msg = `[error] counter=${counter.value}`;
        addLog(msg);
        console.error(msg);
      }
      if (k.name === "q") runtime.exit(0);
    });

    onTick(() => {
      if (counter.value % 10 === 0) {
        addLog(`[tick] カウンター=${counter.value}`);
      }
      if (counter.value % 15 === 0) console.log(`[tick] counter=${counter.value}`);
    }, 1000);

    return { counter, selected, sidebarWide, logs };
  },

  render({ counter, selected, sidebarWide, logs }) {
    const sidebarW = sidebarWide.value ? "22%" : "16%";
    const menu = OutlineBox(
      "menu",
      [
        Text("インスペクター / Inspector").foreground(81),
        Text("Keys: 1/2/3 tab"),
        Text("s sidebar"),
        Text("↑/↓ counter"),
        Text("l log  e error  q quit"),
        Text("Tabs / タブ").foreground(81),
        Toggle("1 Layout", selected.value === "layout"),
        Toggle("2 Style", selected.value === "style"),
        Toggle("3 Text", selected.value === "text"),
        Text("Tags").foreground(81),
        Tag("bg=17", 17),
        Tag("bg=52", 52),
        Tag("bg=88", 88),
        Tag("bg=124", 124),
      ],
      sidebarW,
    ).height("100%");
    menu.style.margin = [0, 0, 0, 0];

    const header = HStack([
      Text(`counter ${counter.value}`).foreground(229),
      Text("btuin DevTools / Inspector").foreground(81),
      Text("状態: 実行中 / running").foreground(247),
      Tag("stack=z", 90, 16),
    ])

      .outline({ color: 243, style: "single", title: "status" });
    header.style.margin = [0, 0, 0, 0];

    const complexLayout = OutlineBox(
      "layout panel",
      [
        Text("複雑レイアウト / Complex layout").foreground(81),
        HStack([
          OutlineBox("fixed", [Text("Fixed 8x3"), Text("固定幅")], 8).height(3),
          Block(Text("Grow flex=1"))
            .grow(1)
            .height(3)
            .outline({ color: 244, style: "single", title: "grow" }),
          Block(Text("Abs overlay")).width(10).height(3),
        ]),
        ZStack([
          Block(Text("ZStack base")).width(20).height(5),
          Block(Text("Overlay A"))
            .width(10)
            .height(3)
            .outline({ color: 244, style: "double", title: "overlay" }),
          Block(Text("Overlay B"))
            .width(8)
            .height(2)
            .outline({ color: 245, style: "single", title: "overlay b" }),
        ])
          .width(22)
          .height(5)
          .outline({ color: 244, style: "single", title: "zstack" }),
      ],
      undefined,
    );

    const diverseStyle = OutlineBox(
      "style panel",
      [
        Text("多様なスタイル / Diverse style").foreground(81),
        HStack([
          Block(Text("padding=[1,2,1,2]"))
            .padding([1, 2, 1, 2])
            .outline({ color: 244, style: "single", title: "pad array" }),
          Block(Text("bg=magenta fg=white"))
            .padding(1)
            .background("magenta")
            .foreground("white")
            .outline({ color: "cyan", style: "double", title: "named colors" }),
        ]),
        (() => {
          const wrapRow = Block(
            Tag("flexWrap=wrap", 24, 231),
            Tag("tag", 31, 231),
            Tag("long-tag", 32, 231),
            Tag("日本語", 33, 231),
            Tag("emoji👩🏽‍💻", 34, 231),
            Tag("1234567890", 35, 231),
          )
            .direction("row")
            .width("100%")
            .outline({ color: 244, style: "single", title: "flexWrap (visual)" });
          wrapRow.style.flexWrap = "wrap";
          return wrapRow;
        })(),
      ],
      undefined,
    );

    const mixedText =
      "ASCII: The quick brown fox jumps over the lazy dog. / " +
      "CJK: 日本語の文章と漢字、かな、カナ。 / " +
      "Emoji: 👩🏽‍💻🧪✨ / " +
      "Wide: ＷＩＤＥ ＴＥＸＴ / " +
      "Mixed: hello世界123";

    const textPanel = OutlineBox("text panel", [
      Text("文字 / Text (ASCII + CJK + emoji)").foreground(81),
      VStack([
        TextBox({
          title: "No wrap / truncate",
          content: mixedText,
          width: BOX_W,
          wrap: false,
          fg: 253,
          outlineStyle: "single",
        }).setKey("textbox:nowrap"),
        TextBox({
          title: "Wrap / wrapTextWidth",
          content: mixedText,
          width: BOX_W,
          wrap: true,
          fg: 253,
          outlineStyle: "double",
        }).setKey("textbox:wrap"),
      ]),
    ]);

    const content =
      selected.value === "layout"
        ? complexLayout
        : selected.value === "style"
          ? diverseStyle
          : textPanel;

    const logsBox = OutlineBox(
      "logs",
      [
        Text("ログ / Logs").foreground(81),
        ...logs.value.map((line, idx) => Text(`${String(idx + 1).padStart(2, "0")} ${line}`)),
      ],
      "24%",
    ).height("100%");

    const main = VStack([header, content.grow(1)])
      .grow(1)
      .height("100%");

    return HStack([menu, main, logsBox]).height("100%");
  },
});

await app.mount();
