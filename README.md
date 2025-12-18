# btuin

**btuin** (pronounced _between_) は、Bun ランタイム向けに設計された、モダンで高速な TUIフレームワークです。
Vue.js の Composition API を意識したリアクティビティシステムとSwiftUIライクな表現を採用しており、宣言的かつ直感的に CLI アプリケーションを構築できます。

## 目的 (Goal)

Bunのパフォーマンスを最大限に活かし、快適な開発体験をターミナルアプリケーション開発にもたらすことを目的としています。

複雑になりがちなカーソル制御や描画更新ロジックを隠蔽し、開発者が状態とビューの定義に集中できる環境を提供します。

## 利点 (Features)

- **Vue ライクなリアクティビティ**: `ref`, `computed`, `watch`, `effect` などを備えた独自のリアクティビティシステムを搭載。状態の変化に応じて画面の差分だけを自動的に効率よく再描画します。
- **宣言的レイアウト**: `VStack`, `HStack`, `ZStack` などのレイアウトプリミティブを提供。絶対座標を計算することなく、Flexbox のように柔軟な UI を構築できます。
- **Bun ネイティブ**: Bun の高速な起動と実行速度、Bunのネイティブ API を活用し、軽量かつハイパフォーマンスに動作します。
- **コンポーネント指向**: `defineComponent` による再利用可能なコンポーネント設計が可能。標準で `List`, `Table`, `Input`, `ProgressBar` などの実用的な UI キットを提供しています。
- **フォーカス管理**: キーボード操作を前提としたフォーカス移動（Tab や矢印キー）の仕組みが組み込まれています。

## ロードマップ (Roadmap)

以下の機能を計画しています。

- [x] **コア機能**: リアクティビティシステム、基本レンダリングループ
- [x] **レイアウト**: Stack (Vertical, Horizontal, Z-axis), Box, Center
- [x] **基本コンポーネント**: Paragraph, TextInput, List, Console
- [ ] **入力拡張**: マウスイベントのサポート、ショートカットキー管理の強化
- [ ] **スタイル**: テーマ機能の実装、より高度なボーダー・カラー設定

- [ ] **エコシステム**: デバッグツールの充実、ドキュメント整備
- [ ] **拡張コンポーネント**: Table, ProgressBar, Spinner, Toast, Selector

## クイックスタート

> **前提**: Bun（`bun` コマンド）がインストール済みであること。

### セットアップ

```bash
pnpm install
```

### テスト

```bash
pnpm test
```

### すぐ動くサンプル（showcase）

```bash
# ネオン風ダッシュボード（↑/↓で選択 / space でテーマ切替 / a でログ追加 / q で終了）
bun examples/neon-dashboard.ts
```

### Profiling / Perf Regression

```bash
# 大量要素のストレス（JSON出力、--io=off で stdout を捨てて純粋な計算寄りに）
bun run profile:stress --n=10000 --frames=120 --io=off --out=profiles/stress.json

# パフォーマンス予算テスト（将来的にCIで回帰検知に使う想定）
# 例: まずは計測してから budget を詰めるのがおすすめ
bun run perf:budget --task=frame --n=10000 --iterations=30 --out=profiles/budget.json
bun run perf:budget --task=diff --rows=200 --cols=400 --iterations=20 --out=profiles/budget-diff.json

# bun test に載せる場合（CI or BTUIN_PERF=1 のときのみ実行）
CI=1 bun run test:perf
# 予算/サイズは env で上書き可能（例: BTUIN_BUDGET_FRAME_P95=120 など）
```

## 使い方（最小例）

```ts
import { createApp, VStack, Text, ref } from "btuin";

const app = createApp({
  init({ onKey }) {
    const count = ref(0);
    onKey((k) => {
      if (k.name === "up") count.value++;
      if (k.name === "down") count.value--;
      if (k.name === "q") process.exit(0);
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

## 設計メモ（ざっくり）

- `@btuin/reactivity`: `ref/computed/effect/watch` による状態管理
- `@btuin/layout-engine`: Flexbox ライクなレイアウト（WASM）
- `@btuin/renderer`: バッファ描画 + 差分レンダリング（`renderDiff` は文字列を返す純粋関数）
- `@btuin/terminal`: raw mode / 入力 / stdout 書き込み
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
