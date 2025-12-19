# btuin 状態管理リファレンス

btuinでは、宣言的にUIを記述するためにリアクティブな状態管理システムが提供されています。`createApp`の`init`関数でアプリケーションの状態を定義し、その状態が変更されるとUIが自動的に更新されます。

このシステムはVue.jsのComposition APIに強く影響を受けています。

## 基本的なデータフロー

1.  **`init(context)`**: アプリケーションの初期状態をオブジェクトとして返します。ここで`ref`や`computed`を使ってリアクティブな状態を定義します。
2.  **`render(state)`**: `init`から返された状態オブジェクトを引数として受け取り、現在の状態に基づいたUI（ViewElement）を返します。

```typescript
import { createApp, Text, ref } from "btuin";

createApp({
  init({ onKey }) {
    // 1. リアクティブな状態を定義
    const count = ref(0);

    onKey(() => {
      // 状態を変更すると...
      count.value++;
    });

    // stateオブジェクトとして返す
    return { count };
  },
  render({ count }) {
    // 2. ...UIが自動的に更新される
    return Text(`Count: ${count.value}`);
  },
});
```

---

## 基本的な状態の定義: `ref`

`ref()` は、任意の値を受け取り、その値を`.value`プロパティに持つリアクティブなオブジェクトを返します。これにより、プリミティブな値（数値や文字列など）でもリアクティブに扱うことができます。

```typescript
import { ref } from "btuin";

// refオブジェクトを作成
const count = ref(0);

// 値へのアクセスと変更は .value プロパティを経由する
console.log(count.value); // 0

count.value++;

console.log(count.value); // 1
```

---

## 派生状態の作成: `computed`

`computed()` は、リアクティブな状態から派生した値を計算するために使用します。元の状態が変更されると、`computed`の値も自動的に更新されます。結果はキャッシュされ、依存関係が変更された場合にのみ再計算されるため効率的です。

```typescript
import { ref, computed } from "btuin";

const count = ref(1);

// countから派生したcomputedを作成
const double = computed(() => count.value * 2);

console.log(double.value); // 2

count.value = 5;

console.log(double.value); // 10
```

`computed`はデフォルトで読み取り専用ですが、`get`と`set`を持つオブジェクトを渡すことで、書き込み可能な`computed`も作成できます。

---

## 副作用の実行: `watch` と `watchEffect`

リアクティブな状態の変更を監視し、副作用（コンソール出力、非同期リクエストなど）を実行するために使用します。

### `watchEffect`

`watchEffect` は、渡された関数を即座に実行し、その実行中にアクセスされたすべてのリアクティブな依存関係を自動的に追跡します。いずれかの依存関係が変更されると、関数が再実行されます。

**使用例:**

```typescript
import { ref, watchEffect } from "btuin";

const count = ref(0);

// count.valueが変更されるたびに実行される
watchEffect(() => {
  console.log(`現在のカウント: ${count.value}`);
});
// -> "現在のカウント: 0" が即座に出力される

count.value++;
// -> "現在のカウント: 1" が出力される
```

### `watch`

`watch` は、特定の一つまたは複数のデータソースを監視します。`watchEffect`とは異なり、以下の特徴があります。

- 副作用を即座には実行しません（`immediate: true` オプションで変更可能）。
- どのデータソースを監視するかを明示的に指定します。
- 変更後の値と変更前の値の両方にアクセスできます。

**使用例:**

```typescript
import { ref, watch } from "btuin";

const count = ref(0);

// 'count' refを監視
watch(count, (newValue, oldValue) => {
  console.log(`カウントが ${oldValue} から ${newValue} に変わりました。`);
});

count.value = 10;
// -> "カウントが 0 から 10 に変わりました。" と出力される
```
