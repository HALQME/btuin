# アーキテクチャ

## コア設計

btuinは、状態・レイアウト・レンダリング・I/Oの4つの関心を個別のモジュールに分離しています。UIは宣言的にコンポーネントツリーとして定義され、フレームワークがレイアウト、レンダリング、更新を処理します。

## モジュール

- **`reactivity`**: きめ細かなリアクティビティシステムを提供します。`ref`が変更されると、依存する`computed`や`effect`関数のみが再評価され、仮想DOMを回避します。

- **`layout-engine`**: Rustで構築されたレイアウトエンジンであるTaffyをFFI経由で実行され、高性能なレイアウト計算を実現します。

- **`renderer`**: ダブルバッファシステムを使用。前回と現在のUI状態を比較し、ターミナル更新のための最小限のANSIエスケープコードを生成することで、ちらつきを削減します。

- **`terminal`**: 低レベルのターミナルI/Oを処理します。キー入力などのイベントのためにANSIエスケープシーケンスを解析し、rawモードを管理します。

- **`btuin` (ランタイム)**: 他のすべての部分を統合する最上位モジュール。`createApp`を提供し、アプリケーションのライフサイクルを管理し、コンポーネントAPIを公開します。

## コンポーネントコンテキスト（Provide/Inject）

btuin は、props のバケツリレーを避けて子孫コンポーネントへ値を渡すための、Vue 風のコンテキスト機構を提供します。

- `provide(key, value)`: 現在のコンポーネントインスタンスに値を登録します。
- `inject(key, defaultValue?)`: 親インスタンスを辿って値を解決します。見つからない場合は `defaultValue`（未指定なら `undefined`）を返します。

キーは `string` または型付き `symbol`（`InjectionKey<T>`）を利用できます。`provide()` / `inject()` はコンポーネント初期化（`setup` / `init`）中に呼ぶことを想定しており、それ以外で呼ぶと警告を出してデフォルト値にフォールバックします。

```ts
import { defineComponent, inject, provide, ui } from "btuin";

const Child = defineComponent({
  setup() {
    const theme = inject("theme", "dark");
    return () => ui.Text(`theme=${theme}`);
  },
});

const Parent = defineComponent({
  setup() {
    provide("theme", "light");
    return () => ui.Block(/* ... */);
  },
});
```

![Provide/Inject の解決経路](./assets/context-provide-inject.svg)

## ヘッドレス実行

I/Oが分離されているため、btuinはヘッドレス環境（例: CI）で実行できます。UIはTTYインターフェースに描画され、結果は`runtime.setExitOutput()`で`stdout`に送られます。`Bun.Terminal`はプログラムによるテストに使用できます。

```ts
// ヘッドレス実行の例
import { Bun } from "bun";

const terminal = new Bun.Terminal({
  cols: 80,
  rows: 24,
  data(_term, data) {
    // このストリームからのUI出力をアサートする
  },
});
const proc = Bun.spawn(["bun", "run", "my-app.ts"], { terminal });
terminal.write("q"); // キー入力をシミュレート
await proc.exited;
```

## アダプタ

アダプタパターンは、プラットフォームとターミナルの詳細を抽象化し、移植性とテスト容易性を向上させます。カスタムアダプタを`createApp`に渡すことで、I/Oをモックできます。

```ts
import { createApp, type TerminalAdapter } from "btuin";

// モックアダプタの例
const myMockTerminalAdapter: Partial<TerminalAdapter> = {
  write: (data) => {
    /* 書き込みをモック */
  },
  onKey: (listener) => {
    /* リスナーをモック */
  },
};

createApp({ terminal: myMockTerminalAdapter /* ... */ });
```

# Inline モード

Inline モードは、ターミナル全体を `clear` せずに現在のカーソル位置から UI を描画します。プロンプトや進捗表示など、スクロールバックを残したい用途に向いています。

## 基本

```ts
import { createApp, ui } from "btuin";

const app = createApp({
  init: () => ({}),
  render: () => ui.Text("Hello (inline)"),
});

await app.mount({ inline: true });
```

## 終了時のクリーンアップ

- `inlineCleanupOnExit: false`（デフォルト）: 最後に描画された UI をそのまま残します。
- `inlineCleanupOnExit: true`: `exit()` / `unmount()` 時に inline UI を消します。

```ts
await app.mount({ inline: true, inlineCleanupOnExit: true });
```

## stdout/stderr のパススルー

デフォルトのターミナルアダプタで inline モードを使う場合、`process.stdout` / `process.stderr`（`console.log` 等）への出力は inline UI の上に表示され、出力後に UI が再描画されます。
