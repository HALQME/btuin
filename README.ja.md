# btuin

Bunランタイム向けの宣言的なTUIフレームワーク。

## 特徴

- **宣言的なUI**: コンポーネントのツリーでインターフェースを記述します。
- **リアクティビティモデル**: 依存する状態（`ref`, `computed`）が変更されると、UIが自動的に更新されます。フレームワークは依存関係を追跡し、仮想DOMを使用せずに必要なコンポーネントのみを再描画します。
- **Flexboxベースのレイアウト**: Rustベースのレイアウトエンジンである[Taffy](https://github.com/DioxusLabs/taffy)をFFI経由で使用し、Flexboxのようなレイアウトを計算します。
- **最適化されたレンダリング**: レンダラーは、前回と現在の画面状態との差分を作成することで、TTYへの書き込みを削減します。また、スクロールパフォーマンスを最適化するための部分的な再描画もサポートしています。
- **Bunネイティブ**: Bunランタイム向けに構築されており、その高速なTTY、FFI、および疑似ターミナルAPIを活用しています。
- **型安全**: TypeScriptで記述されています。

## 開発体験

- **ホットリロード**: `btuin dev`コマンドは、ファイルの変更を監視する開発ランナーを提供し、変更時にTUIを自動的に再起動することで、高速なフィードバックループを可能にします。

- **ブラウザベースのDevTools**: 統合されたインスペクターを使用すると、Webブラウザでリアルタイムにコンポーネントツリーの表示、コンポーネントレベルのログの確認、レイアウトとレンダリングのデバッグが可能です。

## インストール

```bash
bun add btuin
```

公開/インストール詳細: `docs/github-packages.md`

## 使い方

次のコードは、矢印キーで増減するシンプルなカウンターを作成します。

```ts
import { createApp, ref, ui } from "btuin";

const app = createApp({
  // `init`は状態とイベントリスナーをセットアップするために一度だけ呼び出されます。
  init({ onKey, runtime }) {
    const count = ref(0);

    onKey((keyEvent) => {
      if (keyEvent.name === "up") count.value++;
      if (keyEvent.name === "down") count.value--;
      if (keyEvent.name === "q") runtime.exit(0);
    });

    return { count };
  },

  // `render`はUIツリーを返します。状態が変化するたびに再実行されます。
  render({ count }) {
    return ui
      .VStack([ui.Text("Counter"), ui.Text(String(count.value))])
      .width("100%")
      .height("100%")
      .justify("center") // 子要素を垂直方向に中央揃え
      .align("center"); // 子要素を水平方向に中央揃え
  },
});

await app.mount();
```

## より多くの例

### インラインプログレスバー

ターミナル画面全体をクリアせずにUIをインラインでレンダリングできます。これは、プログレスバー、プロンプト、またはターミナルのスクロールバック履歴を妨げるべきではないインタラクティブツールに役立ちます。

`inline`モードがアクティブな場合、`stdout`と`stderr`は自動的にレンダリングされたUIの上にルーティングされます。

```ts
import { createApp, ref, ui } from "btuin";

const app = createApp({
  init({ onKey, onTick, runtime, setExitOutput }) {
    const progress = ref(0);

    onKey((k) => k.name === "q" && runtime.exit(0));

    onTick(() => {
      progress.value++;
      if (progress.value >= 100) {
        setExitOutput("完了！");
        runtime.exit(0);
      }
    }, 25);

    return { progress };
  },
  render({ progress }) {
    return ui.Text(`進捗: ${progress.value}%`);
  },
});

await app.mount({
  inline: true,
  // 終了時に画面からUIをクリアする
  inlineCleanupOnExit: true,
});
```

### 仮想化リスト

`btuin`は、仮想化された`Windowed`コンポーネントを使用して、アイテムの長いリストを効率的にレンダリングできます。表示されているアイテム（および「オーバースキャン」バッファー）のみがレンダリングされるため、何千ものアイテムがあっても高いパフォーマンスが維持されます。

```ts
import { createApp, ref, ui } from "btuin";

const TOTAL = 50_000;
const items = Array.from({ length: TOTAL }, (_, i) => `アイテム ${i}`);

const app = createApp({
  init({ onKey, runtime }) {
    const scrollIndex = ref(0);

    onKey((k) => {
      if (k.name === "q") runtime.exit(0);
      // 注: `clampWindowedStartIndex`は、スクロールインデックスが
      // 有効な範囲内に収まるようにするためのヘルパーです。
      if (k.name === "down") scrollIndex.value++;
      if (k.name === "up") scrollIndex.value--;
      if (k.name === "pagedown") scrollIndex.value += 20;
      if (k.name === "pageup") scrollIndex.value -= 20;
    });

    return { scrollIndex };
  },
  render({ scrollIndex }) {
    const list = ui.Windowed({
      items,
      startIndex: scrollIndex.value,
      renderItem: (item) => ui.Text(item),
    });

    return ui.VStack([
      ui.Text(`${items.length}個のアイテムを表示中（qで終了）`),
      list,
    ]);
  },
});

await app.mount();
```

## API概要

- `createApp(options)`: アプリケーションインスタンスを作成します。
  - `options.init`: 状態を初期化し、リスナーを登録する関数。
  - `options.render`: UIコンポーネントツリーを返す関数。
- `ref(value)`: リアクティブな状態変数を作成します。
- `computed(() => ...)`: 派生リアクティブ値を作成します。
- `watch(ref, () => ...)`: refが変更されたときに副作用を実行します。
- `ui`: プリミティブコンポーネントを含むオブジェクト (`Text`, `Block`, `VStack`など)。

## リンク

- [**アーキテクチャ**](./docs/architecture.ja.md): コア設計、リアクティビティシステム、レンダリングパイプラインについて。
- [**開発ツール**](./docs/devtools.ja.md): ブラウザベースのインスペクタとホットリロードの使い方。
- [**GitHub**](https://github.com/HALQME/btuin): ソースコード、Issue、コントリビューション。

## 言語

- [English (英語)](./README.md)

## コントリビューション

コントリビューションを歓迎します。

> このリポジトリはmiseでツールを管理しています (`mise install`)。

### 開発セットアップ

```bash
# 依存関係をインストール
mise exec -- bun install --frozen-lockfile

# ネイティブのレイアウトエンジンをビルド
mise run build:ffi

# テストを実行
mise run test
```
