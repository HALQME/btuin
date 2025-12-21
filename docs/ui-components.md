# btuin UIコンポーネントリファレンス

btuinのUIは、再利用可能なコンポーネントを組み合わせて構築されます。すべてのコンポーネントは、メソッドチェーンを使ってスタイルを適用できる共通のベースビューを継承しています。

## 基本的なスタイリング

ほとんどのUIコンポーネントでは、以下のメソッドをチェーンしてスタイルを適用できます。

- `.width(value: number | string)`: 幅を指定します（例: `10`, `"50%"`）。
- `.height(value: number | string)`: 高さを指定します。
- `.padding(value: number)`: 内側の余白を指定します。
- `.border(style: "single" | "double" | "round" = "single")`: 境界線を設定します。
- `.color(name: string)`: 前景色（テキストの色など）を設定します。
- `.background(name: string)`: 背景色を設定します。

---

## レイアウトコンテナ

アプリケーションのレイアウト構造を定義するためのコンポーネントです。

### `VStack(children: ViewElement[])`

子要素を垂直方向（上から下）に並べます。`flex-direction: column` を持つ `Block` のショートカットです。

```typescript
import { VStack, Text, Block } from "btuin";

VStack([
  Text("Line 1"),
  Text("Line 2"),
  Block().height(1).background("red"), // 1行の高さの赤い線
  Text("Line 3"),
]);
```

### `HStack(children: ViewElement[])`

子要素を水平方向（左から右）に並べます。`flex-direction: row` を持つ `Block` のショートカットです。

```typescript
import { HStack, Text } from "btuin";

HStack([Text("Left"), Text("Center"), Text("Right")]);
```

### `ZStack(children: ViewElement[])`

子要素をZ軸方向（手前から奥）に重ねて配置します。すべての子要素は同じ開始位置から描画されます。

```typescript
import { ZStack, Text } from "btuin";

ZStack([Text("背景のテキスト"), Text("前面のテキスト").color("red")]);
```

---

## 基本的なビルディングブロック

より複雑なレイアウトを構築するための基本的な要素です。

### `Block(...children: ViewElement[])`

最も基本的なレイアウトコンポーネントです。デフォルトでは子要素を垂直に並べますが、`.direction()` メソッドでレイアウトの方向を変更できます。`VStack` や `HStack` は `Block` を使って作られています。

**主なメソッド:**

- `.direction(dir: "row" | "column")`: 子要素の配置方向を `水平` または `垂直` に設定します。
- `.justify(value: "flex-start" | "center" | "space-between" | "flex-end")`: 主軸（`direction`で指定した方向）に沿った子要素の配置方法を定義します。
- `.align(value: "flex-start" | "center" | "flex-end" | "stretch")`: 交差軸に沿った子要素の配置方法を定義します。

**使用例:**

```typescript
import { Block, Text } from "btuin";

// 要素を中央に配置するコンテナ
Block(Text("中央に表示"))
  .width("100%")
  .height("100%")
  .justify("center")
  .align("center");
```

---

## プリミティブ要素

UIを構成する最も基本的な要素です。

### `Text(content: string)`

文字列を表示するためのコンポーネントです。

**使用例:**

```typescript
import { Text } from "btuin";

Text("こんにちは、世界！");
```

### `Spacer(grow: number = 1)`

レイアウト内で利用可能な余白を埋めるための柔軟な空きスペースを作成します。`HStack` や `VStack` 内で要素間のスペースを空けたり、特定の位置に要素を配置したりするのに便利です。

**使用例:**

```typescript
import { HStack, Text, Spacer } from "btuin";

// 左寄せと右寄せのテキストを作成
HStack([
  Text("左側"),
  Spacer(), // 中央の空きスペースをすべて埋める
  Text("右側"),
]).width("100%");
```
