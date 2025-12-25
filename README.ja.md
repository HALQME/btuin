# btuin

Bunランタイム向けの宣言的なTUIフレームワーク。

## 特徴

- **きめ細かなリアクティビティ**: 仮想DOMは使用しません。状態の変更に依存するコンポーネントのみが再描画されます。
- **Flexboxベースのレイアウト**: Rust製のエンジンがFlexboxのサブセットを実装し、レスポンシブなレイアウトを実現します。
- **Bunネイティブ**: Bunの高速なTTY、FFI、疑似ターミナルAPIと統合されています。
- **型安全**: TypeScriptで書かれています。

## インストール

```bash
bun add btuin
```

公開/インストール詳細: `docs/github-packages.md`

## 使い方

```ts
import { createApp, ref, ui } from "btuin";

const app = createApp({
  // init: 状態とイベントリスナーをセットアップ
  init({ onKey, runtime }) {
    const count = ref(0);

    onKey((keyEvent) => {
      if (keyEvent.name === "up") count.value++;
      if (keyEvent.name === "down") count.value--;
      if (keyEvent.name === "q") runtime.exit(0);
    });

    return { count };
  },

  // render: UIツリーを返す。状態が変化すると再実行される。
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

## Inline モード

ターミナル全体を消さずに描画します:

```ts
await app.mount({ inline: true, inlineCleanupOnExit: true });
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

- [**ドキュメント**](./docs/) (アーキテクチャ, ロードマップ)
- [**Inline モード**](./docs/inline-mode.ja.md)
- [**DevTools**](./docs/devtools.ja.md)
- [**ホットリロード**](./docs/hot-reload.ja.md)
- [**GitHub**](https://github.com/HALQME/btuin) (ソースコード, Issue)

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
