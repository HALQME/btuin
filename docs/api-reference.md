# btuin APIリファレンス

`btuin`でアプリケーションを作成する際、`createApp`の`init`関数を通じて、アプリケーションのライフサイクルやイベントを管理するための様々なAPIにアクセスできます。

```typescript
import { createApp } from "btuin";

createApp({
  init(context) {
    // ここでcontextオブジェクトを通じて各種APIを使用します
    // context: { onKey, onExit, setExitOutput, runtime, getSize, onResize, getEnv }
  },
  render(state) {
    // ...
  },
});
```

以下は`init`のコンテキストオブジェクトから利用可能な主なAPIです。

---

### `onKey(handler: (key: KeyEvent) => void)`

キーボード入力を購読します。ユーザーがキーを押すたびに、登録したハンドラ関数が呼び出されます。

**`KeyEvent`オブジェクトの主なプロパティ:**

- `name`: キーの名前（例: 'up', 'down', 'a', 'b'）
- `ctrl`: Ctrlキーが同時に押されたか (boolean)
- `meta`: Metaキー（Commandキー on macOS）が同時に押されたか (boolean)
- `shift`: Shiftキーが同時に押されたか (boolean)

**使用例:**

```typescript
init({ onKey, runtime }) {
  onKey((key) => {
    // 'q'キーが押されたらアプリケーションを終了
    if (key.name === 'q') {
      runtime.exit();
    }
  });
}
```

---

### `runtime.exit(code: number = 0)`

アプリケーションを正常に終了させます。終了コードを指定することもできます。

**使用例:**

```typescript
init({ onKey, runtime }) {
  onKey((key) => {
    if (key.name === 'c' && key.ctrl) {
      // Ctrl+Cで終了コード1で終了
      runtime.exit(1);
    }
  });
}
```

---

### `onExit(handler: () => void)`

アプリケーションが終了する際に、クリーンアップ処理などの副作用を実行するためのコールバック関数を登録します。

**注意:** このハンドラ内での`console.log`などの画面出力は、その後の画面クリア処理によって表示されないことがあります。画面にメッセージを表示したい場合は `setExitOutput` を使用してください。

**使用例:**

```typescript
init({ onExit }) {
  onExit(() => {
    // 例: データベース接続を閉じる、一時ファイルを削除するなどの処理
    console.log("アプリケーションのクリーンアップ処理を実行しました。");
  });
}
```

---

### `setExitOutput(output: string | (() => string))`

アプリケーションが終了した後に、コンソールに表示されるメッセージを設定します。`onExit`の処理結果を反映させたい場合など、動的にメッセージを生成したい場合は、関数を渡すことができます。

**使用例:**

```typescript
init({ onKey, runtime, onExit, setExitOutput }) {
  let message = "ユーザーによって終了されました。";

  onExit(() => {
    // onExitでの処理に応じてメッセージを変更
    message = "設定を保存して終了しました。";
  });

  // 終了時に表示するメッセージをセット
  setExitOutput(() => message);

  onKey((key) => {
    if (key.name === 'q') {
      runtime.exit();
    }
  });
}
```

---

### `getSize(): { rows: number, cols: number }`

現在のターミナルのサイズ（行数と列数）を取得します。

**使用例:**

```typescript
init({ getSize }) {
  const { rows, cols } = getSize();
  console.log(`現在のターミナルサイズ: ${cols}x${rows}`);
}
```

---

### `onResize(handler: () => void)`

ターミナルのウィンドウサイズが変更されたときに呼び出されるハンドラを登録します。

**使用例:**

```typescript
init({ onResize, getSize }) {
  onResize(() => {
    const { cols, rows } = getSize();
    console.log(`リサイズ後のターミナルサイズ: ${cols}x${rows}`);
    // ここでUIの再描画などをトリガーできます
  });
}
```

---

### `getEnv(name: string): string | undefined`

指定された名前の環境変数の値を取得します。

**使用例:**

```typescript
init({ getEnv }) {
  const logLevel = getEnv("LOG_LEVEL") ?? "info";
  console.log(`ログレベル: ${logLevel}`);
}
```
