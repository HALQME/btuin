# btuin 高度なガイド

基本的なAPIに慣れたら、より複雑で再利用可能なコンポーネントや、堅牢なアプリケーションを構築するための高度な機能を活用できます。

---

## 1. カスタムコンポーネントの作成

アプリケーションが複雑になるにつれて、UIの一部を自己完結したコンポーネントとして切り出すことが重要になります。btuinでは、状態、ロジック、描画をカプセル化した再利用可能なコンポーネントを簡単に作成できます。

コンポーネントの定義には、主に2つの方法があります。

1.  **高レベルな `setup` 方式**: `props` と `setup` 関数を使ってコンポーネントを定義する方法。再利用性が高く、ほとんどのケースで推奨されます。
2.  **低レベルな `init`/`render` 方式**: `createApp` に渡すオブジェクトと似た構造で、より直接的にコンポーネントを定義する方法。

---

### 方法1: 高レベルな `setup` 方式（推奨）

コンポーネントは `defineComponent` 関数を使って定義します。これは `props`（コンポーネントが受け取るデータ）と `setup`（コンポーネントのロジック）を持つオブジェクトを引数に取ります。

- **`props`**: 親コンポーネントから渡されるプロパティを定義します。型、必須要件、デフォルト値などを指定できます。
- **`setup(props)`**: コンポーネントの主要なロジックを記述します。`props`オブジェクトを引数として受け取り、**描画関数**を返す必要があります。リアクティブな状態の定義やライフサイクルメソッドの登録もここで行います。

#### 使用例: `Counter` コンポーネント

`initialValue` というプロパティを受け取り、内部でカウンターを管理するコンポーネントを作成してみましょう。

```typescript
import { defineComponent, ref, computed, Text, HStack, Spacer } from "btuin";

export const Counter = defineComponent({
  props: {
    initialValue: { type: Number, default: 0 },
  },
  setup(props) {
    const count = ref(props.initialValue);
    const double = computed(() => count.value * 2);
    const increment = () => count.value++;

    return () =>
      HStack([
        Text(`Count: ${count.value} (Double: ${double.value})`),
        Spacer(),
        Text("[+]").onKey("enter", increment),
      ]);
  },
});
```

#### カスタムコンポーネントの使用

定義したコンポーネントは、他のコンポーネントと同様に `render` 関数内で使用できます。プロパティは第2引数にオブジェクトとして渡します。

```typescript
// app.ts
import { createApp, VStack } from "btuin";

createApp({
  render() {
    return VStack([
      Counter({ initialValue: 5 }), // propsを渡して使用
      Counter(), // デフォルト値が使われる
    ]);
  },
});
```

### 方法2: 低レベルな `init`/`render` 方式

こちらは、`createApp` に渡すアプリケーション定義と非常によく似た構造を持つ、より基本的なコンポーネント定義方法です。

- **`init(context)`**: コンポーネントのインスタンスが作成されるときに一度だけ実行されます。ここで状態を初期化し、`render` 関数に渡す `state` オブジェクトを返します。
- **`render(state)`**: `init` から返された `state` を受け取り、UIを描画します。

この方式は `props` を直接受け取るための組み込みの仕組みを持ちません。しかし、コンポーネントを返すファクトリ関数を作成し、クロージャを利用することで `props` を渡すことが可能です。

#### 使用例: `Label` コンポーネント

`label` という文字列をプロパティとして受け取り表示するコンポーネント。

```typescript
import { defineComponent, Text, type Component } from "btuin";

// Propsを型として定義
interface LabelProps {
  label: string;
}

// コンポーネントを返すファクトリ関数を作成
export function Label(props: LabelProps): Component {
  return defineComponent({
    // このinitはライフサイクルイベントの登録などに使う
    init() {
      // 低レベルなコンポーネントなので、状態はinitの外（クロージャ）で管理
    },
    // render関数はpropsにアクセスできる
    render() {
      return Text(props.label);
    },
  });
}
```

#### カスタムコンポーネントの使用

ファクトリ関数を呼び出す形で使用します。

```typescript
// app.ts
import { createApp, VStack } from "btuin";

createApp({
  render() {
    return VStack([
      Label({ label: "First Label" }),
      Label({ label: "Second Label" }),
    ]);
  },
});
```

---

### どちらを使うべきか？

- **`setup` 方式**は、`props` の定義、デフォルト値、バリデーションなど、再利用可能なコンポーネントを作成するための豊富な機能を提供するため、**ほとんどの場面で推奨**されます。
- **`init`/`render` 方式**は、`createApp` の構造と似ていて理解しやすく、非常にシンプルなコンポーネントや、`props` の仕組みを必要としない場合に手早く使えます。また、クロージャの動作を熟知していれば、より低レベルで柔軟なコンポーネント設計が可能です。

---

## 2. ライフサイクルイベント

コンポーネントが画面に表示されたり、画面から消えたりする特定のタイミングで処理を実行したい場合があります。そのためにライフサイクルフックが用意されています。これらは `setup` 関数（またはルートの `init` 関数）内で使用します。

- **`onMounted(handler)`**: コンポーネントが最初に描画され、DOMにマウントされた直後に呼び出されます。データの取得やタイマーのセットアップに適しています。
- **`onUnmounted(handler)`**: コンポーネントがアンマウントされる（画面から削除される）直前に呼び出されます。`onMounted` で登録したイベントリスナーやタイマーをクリーンアップするのに最適です。

### 使用例: `Clock` コンポーネント

1秒ごとに現在時刻を更新する時計コンポーネント。

```typescript
// components/Clock.ts
import { btuin, ref, onMounted, onUnmounted, Text } from "btuin";

export const Clock = defineComponent({
  setup() {
    const time = ref(new Date().toLocaleTimeString());
    let timerId: any;

    // マウント時にタイマーを開始
    onMounted(() => {
      timerId = setInterval(() => {
        time.value = new Date().toLocaleTimeString();
      }, 1000);
    });

    // アンマウント時にタイマーを停止
    onUnmounted(() => {
      clearInterval(timerId);
    });

    return () => Text(time.value);
  },
});
```

---

## 3. エラーハンドリング

アプリケーション全体で発生した予期せぬエラーを捕捉し、適切に処理するために、`createApp` に `onError` ハンドラを渡すことができます。

`onError` ハンドラは2つの引数を取ります。

- **`error`**: 捕捉された `Error` オブジェクト。
- **`phase`**: エラーが発生したアプリケーションのフェーズ（例: `"mount"`, `"render"`, `"key"`, `"unmount"`）。

これにより、エラーの原因を特定しやすくなります。

### 使用例

```typescript
import { createApp, ... } from "btuin";

createApp({
  init() {
    // ...
  },
  render() {
    if (Math.random() > 0.9) {
      // レンダリング中にエラーを発生させてみる
      throw new Error("レンダリング中に問題が発生しました！");
    }
    return Text("OK");
  },
}, { // createAppの第2引数にオプションとして渡す
  onError(error, phase) {
    // ここでエラーを集中的に処理
    console.error(`[${phase}] フェーズでエラーが発生しました:`, error.message);
    // ログファイルに書き出すなどの処理も可能

    // エラー発生時はアプリケーションを終了させるなどの判断もできる
    // runtime.exit(1);
  },
});
```

---

## 4. パフォーマンス・プロファイリング

アプリケーションのパフォーマンス・ボトルネックを特定するために、組み込みのプロファイラを使用できます。

プロファイラは `createApp` の `profile` オプションを通じて有効化・設定します。

- **`enabled: boolean`**: `true`に設定するとプロファイラが有効になります。
- **`hud: boolean`**: `true`に設定すると、画面の右上にパフォーマンス情報（フレーム時間、メモリ使用量など）がオーバーレイ表示されます。デバッグに非常に便利です。
- **`outputFile: string`**: 指定したパスに、アプリケーション終了時に詳細なパフォーマンスデータをJSON形式で出力します。このファイルを使って、フレームごとのレンダリング時間などを詳しく分析できます。

### 使用例

```typescript
import { createApp, ... } from "btuin";

createApp(
  { /* ... app definition ... */ },
  {
    profile: {
      enabled: true,
      hud: true,
      outputFile: "./profile-results.json",
    },
  }
);
```

この設定でアプリケーションを実行すると、画面右上にHUDが表示され、終了後に`profile-results.json`が生成されます。

---

## 5. コンポーネントのテスト

btuinプロジェクトでは、`bun:test` を利用してテストを記述します。これにより、コンポーネントが期待通りに描画され、機能することを確認できます。

テストの基本的な構造は `describe` でテストスイートを定義し、`it` で個別のテストケースを記述します。アサーションには `expect` を使用します。

### 使用例: `Text` コンポーネントのテスト

```typescript
// tests/text.test.ts
import { describe, it, expect } from "bun:test";
import { Text } from "../src/view/primitives/text";

describe("Text Primitive", () => {
  it("should create a TextElement with the correct content", () => {
    // 1. テスト対象のコンポーネントを作成
    const textView = Text("hello world");

    // 2. 内部的なbuildメソッドなどで描画結果の内部表現を取得
    const element = textView.build();

    // 3. expectを使って結果を検証
    expect(element.type).toBe("text");
    expect(element.content).toBe("hello world");
  });
});
```

### テストの実行

テストを実行するには、プロジェクトのルートディレクトリで以下のコマンドを実行します。

```sh
bun test
```

これにより、`tests` ディレクトリ以下の `*.test.ts` や `*.spec.ts` ファイルが自動的に検索・実行されます。
