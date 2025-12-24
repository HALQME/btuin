# DevTools

btuin には、TUI 開発時の観測性（ログ確認など）に特化した DevTools があります。

- ブラウザ DevTools（ローカルサーバ + WebSocket）
- 外部へログをストリーミング（file / TCP）して `tail -f` や `nc` で別ターミナルから閲覧

## 有効化

`createApp({ devtools: ... })` で有効化します:

```ts
import { createApp, ui } from "btuin";

const app = createApp({
  devtools: { enabled: true },
  init: () => ({}),
  render: () => ui.Text("Hello"),
});
```

## ブラウザ DevTools（おすすめ）

ローカルの DevTools サーバを起動します:

```ts
import { createApp, ui } from "btuin";

const app = createApp({
  devtools: {
    enabled: true,
    server: {
      host: "127.0.0.1",
      port: 0,
      onListen: ({ url }) => console.log(`[devtools] open ${url}`),
    },
  },
  init: () => ({}),
  render: () => ui.Text("Hello"),
});
```

表示された URL をブラウザで開くと、ログとスナップショットが確認できます。

スナップショットは **Preview**（レイアウトのボックス + テキスト）と **JSON**（生の payload）の両方で確認できます。

## `useLog()` フック

`useLog()` は capture した console 出力をリアクティブに参照するためのフックです（ログUIを自作したい場合に使えます）。

オプション:

- `devtools.maxLogLines`（デフォルト: `1000`）

```ts
import { defineComponent, useLog, ui } from "btuin";

export const LogView = defineComponent({
  setup() {
    const log = useLog();
    return () => ui.Text(`lines: ${log.lines.value.length}`);
  },
});
```

注意:

- 基本はコンポーネント `init()` / `setup()` 内で呼ぶ想定（unmount で自動 cleanup）。
- それ以外の場所で呼ぶ場合は `dispose()` を手動で呼んでください。

## file へストリーミング（JSONL）

1行1イベントの JSONL 形式で追記します:

```ts
devtools: {
  enabled: true,
  stream: { file: "/tmp/btuin-devtools.log" },
}
```

例:

```bash
tail -f /tmp/btuin-devtools.log | jq -r '.type + " " + .text'
```

フォーマット（1行=1イベント）:

```json
{ "text": "hello", "type": "stdout", "timestamp": 1730000000000 }
```

## TCP でストリーミング（JSONL）

ローカルで TCP サーバを起動し、接続クライアントへ JSONL を流します:

```ts
devtools: {
  enabled: true,
  stream: {
    tcp: {
      host: "127.0.0.1",
      port: 9229,
      backlog: 200,
      onListen: ({ host, port }) => console.log(`DevTools TCP: ${host}:${port}`),
    },
  },
}
```

別ターミナルから接続:

```bash
nc 127.0.0.1 9229 | jq -r '.type + " " + .text'
```

Backlog:

- `backlog` は直近のログをメモリに保持し、新規接続時に先頭へフラッシュするための行数です。
- 接続前後のタイミングでログを取りこぼしにくくします。

セキュリティ注意:

- 特別な理由がなければ `127.0.0.1` にバインドしてください。
- stdout/stderr が流れるので、公開ポートにする場合は漏洩リスクを理解した上で運用してください。

# ホットリロード（開発用ランナー）

`btuin` の raw 入力処理はプロセス全体で共有されるシングルトンを使っています。そのため、プロセス内で “remount” を繰り返すような HMR（ホットモジュールリロード）的な実装をすると、キー入力ハンドラが積み上がって入力が二重に届くなどの問題が起きます。

そこで現状は、開発時のホットリロードは **プロセスを再起動する方式（dev runner）** を推奨します。変更検知で同じターミナル上で TUI を再実行するだけです。

## CLI

```bash
btuin dev <entry> [options] [-- <args...>]
```

例:

```bash
btuin dev examples/devtools.ts
btuin dev src/main.ts --watch src --watch examples
btuin dev src/main.ts -- --foo bar
```

主なオプション:

- `--watch <path>`（複数指定可）
- `--debounce <ms>`（デフォルト: `50`）
- `--cwd <path>`（デフォルト: `process.cwd()`）
- `--no-preserve-state`（デフォルト: preserve 有効）
- `--no-tcp`（TCP リロードトリガー無効化）
- `--tcp-host <host>`（デフォルト: `127.0.0.1`）
- `--tcp-port <port>`（デフォルト: `0`）

## リスタート時のステート保持

アプリ側で `enableHotReloadState()` を使うと、リスタート間で状態を引き継げます。

ステート保持を無効化:

```bash
btuin dev examples/devtools.ts --no-preserve-state
```

または、ランナー用のスクリプトを作ります:

```ts
import { runHotReloadProcess } from "btuin";

runHotReloadProcess({
  command: "bun",
  args: ["examples/devtools.ts"],
  watch: { paths: ["src", "examples"] },
});
```

実行:

```bash
bun run examples/hot-reload.ts
```

## TCPトリガ（任意）

`btuin dev` はデフォルトで TCP を有効化（ポートは自動選択）します。コード側で明示設定することもできます:

```ts
import { runHotReloadProcess } from "btuin";

runHotReloadProcess({
  command: "bun",
  args: ["examples/devtools.ts"],
  watch: { paths: ["src", "examples"] },
  tcp: {
    host: "127.0.0.1",
    port: 0,
    onListen: ({ host, port }) => {
      process.stderr.write(`[btuin] hot-reload tcp: ${host}:${port}\n`);
    },
  },
});
```

別ターミナルからトリガ:

```bash
printf 'reload\n' | nc 127.0.0.1 <port>
```

JSONLでもOK:

```bash
printf '{"type":"reload"}\n' | nc 127.0.0.1 <port>
```

## ステート保持（任意 / opt-in）

この方式はプロセスを再起動するため、通常はメモリ上の状態はリセットされます。

再起動後も状態を引き継ぎたい場合は、アプリ側で opt-in します:

```ts
import { enableHotReloadState, ref } from "btuin";

const count = ref(0);

enableHotReloadState({
  getSnapshot: () => ({ count: count.value }),
  applySnapshot: (snapshot) => {
    if (!snapshot || typeof snapshot !== "object") return;
    const maybe = (snapshot as any).count;
    if (typeof maybe === "number") count.value = maybe;
  },
});
```
