# btuin

**btuin** (pronounced _between_) は、Bun ランタイム向けに設計された、モダンで高速な TUIフレームワークです。
Vue.js の Composition API を意識したリアクティビティシステムとSwiftUIライクな表現を採用しており、宣言的かつ直感的に CLI アプリケーションを構築できます。

## 目的

Bunのパフォーマンスを最大限に活かし、快適な開発体験をターミナルアプリケーション開発にもたらすことを目的としています。

複雑になりがちなカーソル制御や描画更新ロジックを隠蔽し、開発者が状態とビューの定義に集中できる環境を提供します。

## 利点

- **Vue ライクなリアクティビティ**: `ref`, `computed`, `watch`, `effect` などを備えた独自のリアクティビティシステムを搭載。状態の変化に応じて画面の差分だけを自動的に効率よく再描画します。
- **宣言的レイアウト**: `VStack`, `HStack`, `ZStack` などのレイアウトプリミティブを提供。絶対座標を計算することなく、Flexbox のように柔軟な UI を構築できます。
- **Bun ネイティブ**: Bun の高速な起動と実行速度、Bunのネイティブ API を活用し、軽量かつハイパフォーマンスに動作します。
- **コンポーネント指向**: `defineComponent` による再利用可能なコンポーネント設計が可能。標準で `List`, `Table`, `Input`, `ProgressBar` などの実用的な UI キットを提供しています。
- **フォーカス管理**: キーボード操作を前提としたフォーカス移動（Tab や矢印キー）の仕組みが組み込まれています。

## ロードマップ

以下の機能を計画しています。

- [x] **コア機能**: リアクティビティシステム、基本レンダリングループ
- [x] **レイアウト**: Stack (Vertical, Horizontal, Z-axis), Box, Center
- [x] **基本コンポーネント**: Paragraph, TextInput, List, Console
- [ ] **インラインモード**: ターミナルの全体を書き換えずに描画するモード
- [ ] **入力拡張**: マウスイベントのサポート、ショートカットキー管理の強化
- [ ] **スタイル**: テーマ機能の実装、より高度なボーダー・カラー設定
- [ ] **エコシステム**: デバッグツールの充実、ドキュメント整備
- [ ] **拡張コンポーネント**: Table, ProgressBar, Spinner, Toast, Selector

## クイックスタート

> **前提**: `mise` がインストール済みであること（このリポジトリは `mise.toml` でツールを管理します）。

### セットアップ

```bash
mise install
mise exec -- pnpm install --frozen-lockfile

# Layout Engine (FFI) をビルド（初回/更新時）
mise run build:ffi
```

### テスト

```bash
mise run test
```

### Profiling / Perf Regression

```bash
# 大量要素のストレス
mise run profiler:stress -- --n=10000 --frames=120 --io=off --out=profiles/stress.json

# パフォーマンス上限テスト
mise run profiler:limit
```

## 使い方

```ts
import { createApp, VStack, Text, ref } from "btuin";

const app = createApp({
  init({ onKey, runtime }) {
    const count = ref(0);
    onKey((k) => {
      if (k.name === "up") count.value++;
      if (k.name === "down") count.value--;
      if (k.name === "q") runtime.exit(0);
    });
    return { count };
  },
  render({ count }) {
    return VStack([Text("Counter"), Text(String(count.value))])
      .width("100%")
      .height("100%")
      .justify("center")
      .align("center");
  },
});

await app.mount();
```

## 責務

- `reactivity`: `ref/computed/effect/watch` による状態管理
- `layout-engine`: Flexbox ライクなレイアウト（Rust FFI）
- `renderer`: バッファ描画 + 差分レンダリング（`renderDiff` は文字列を返す純粋関数）
- `terminal`: raw mode / 入力 / stdout 書き込み
- `btuin`: それらを束ねる “アプリ実行” と View API

## アダプタ（テスト/差し替え用）

通常はそのまま `createApp()` を使えば動きます。必要なら I/O を差し替えできます。

```ts
import { createApp } from "btuin";

createApp({
  terminal: {
    // write/onKey/getTerminalSize... など
  },
  platform: {
    // resize/exit/signal... など
  },
  setup() {
    return () => /* view */;
  },
});
```
