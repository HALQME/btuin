# アーキテクチャ

## コア設計

btuinは、状態・レイアウト・レンダリング・I/Oの4つの関心を個別のモジュールに分離しています。UIは宣言的にコンポーネントツリーとして定義され、フレームワークがレイアウト、レンダリング、更新を処理します。

## モジュール

- **`reactivity`**: きめ細かなリアクティビティシステムを提供します。`ref`が変更されると、依存する`computed`や`effect`関数のみが再評価され、仮想DOMを回避します。

- **`layout-engine`**: Rustで構築されたレイアウトエンジンであるTaffyをFFI経由で実行され、高性能なレイアウト計算を実現します。

- **`renderer`**: ダブルバッファシステムを使用。前回と現在のUI状態を比較し、ターミナル更新のための最小限のANSIエスケープコードを生成することで、ちらつきを削減します。

- **`terminal`**: 低レベルのターミナルI/Oを処理します。キー入力などのイベントのためにANSIエスケープシーケンスを解析し、rawモードを管理します。

- **`btuin` (ランタイム)**: 他のすべての部分を統合する最上位モジュール。`createApp`を提供し、アプリケーションのライフサイクルを管理し、コンポーネントAPIを公開します。

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
