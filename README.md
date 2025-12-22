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
- **コンポーネント指向**: `defineComponent` による再利用可能なコンポーネント設計が可能。現状は `Text` / `Block` / `Spacer` などのプリミティブ中心で、実用コンポーネントは順次追加予定です。
- **入力・実行基盤**: raw mode / 差分描画 / stdout capture など、TUI を成立させる足回りを内蔵しています。

## ロードマップ

- [x] 入力
  - [x] 入力パーサーをステートフル化（チャンク分割耐性）: `src/terminal/parser/ansi.ts`
  - [x] `ESC` 単体 vs `Alt+Key` の曖昧さを解消
  - [x] ブラケットペーストを「1イベント」に正規化: `src/terminal/parser/ansi.ts`
  - [x] ブラケットペーストの on/off をランタイムへ統合
- [ ] マウス
  - [ ] マウス入力（SGR など）をランタイムへ統合（有効化/無効化・イベント形式の確定）
  - [ ] ヒットテスト（`ComputedLayout` と座標の照合、重なり順の決定）
  - [ ] バブリング/伝播（子→親、キャンセル可能なイベントモデル）
- [ ] Developer Tools
  - [ ] シェル統合
    - [x] stdout/stderr capture 基盤（listener/console patch/テストモード）: `src/terminal/capture.ts`
    - [ ] `useLog`（capture → reactive state）でログUIを簡単にする
  - [ ] デバッグ
    - [ ] インスペクターモード（境界線/座標/サイズ可視化）
- [x] 配布
  - [x] GitHub Release 用 tarball 生成（`src/layout-engine/native/` 同梱）: `.github/workflows/release.yml`
  - [x] `npm pack` の成果物を展開し、`src/layout-engine/native/` と `src/layout-engine/index.ts` の解決が噛み合うことを自動チェック
- [ ] Inline モード
- [ ] コンポーネント
  - [ ] `TextInput` を実用レベルへ（編集・カーソル移動・IME確定後の反映）
  - [ ] `ScrollView` / `ListView`（必要に応じて仮想スクロール、マウスホイール連動）
- [x] 安全性
  - [x] FFI 境界の同期テスト（Rust 定数/構造体 ↔ JS 定義）を CI に追加
- [ ] ドキュメント / スターター
  - [ ] `examples/` の拡充

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
import { createApp, ref, ui } from "btuin";

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
    return ui
      .VStack([ui.Text("Counter"), ui.Text(String(count.value))])
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
- `terminal`: raw mode / 入力 / TTY へのUI描画
- `btuin`: それらを束ねる “アプリ実行” と View API

## パイプ/ヘッドレスでの実行

- UI描画は可能ならTTYへ直接出力し、`setExitOutput()` で指定した内容だけを標準出力に流します（`fzf`の挙動に近い）。
- ヘッドレス環境では `Bun.Terminal`(PTY) でプロセスを起動すると、PTY越しにUIへアクセスできます。

```ts
const terminal = new Bun.Terminal({
  cols: 80,
  rows: 24,
  data(_term, data) {
    // UIの描画(ANSI)が流れてくる
    process.stdout.write(data);
  },
});

const proc = Bun.spawn(["bun", "run", "examples/counter.ts"], { terminal });
terminal.write("q"); // キー入力
await proc.exited;
```

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
