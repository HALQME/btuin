# DevTools

btuin には、TUI 開発時にアプリを観測するための軽量なブラウザ UI があります。

## ブラウザ DevTools（おすすめ）

開発用ランナー（`btuin dev ...`）を使う場合、ブラウザ DevTools は自動で有効化されます（無効化は `--no-devtools`）。
また、DevTools の URL をブラウザで自動で開きます（無効化は `--no-open-browser`）。

表示された URL をブラウザで開くと、ログとスナップショットが確認できます。

スナップショットは **Preview**（レイアウトのボックス + テキスト）と **JSON**（生の payload）の両方で確認できます。

コードを変更したくない場合は、環境変数でも有効化できます:

- `BTUIN_DEVTOOLS=1`（有効化）
- `BTUIN_DEVTOOLS_HOST` / `BTUIN_DEVTOOLS_PORT`（任意）
- `BTUIN_DEVTOOLS_CONTROLLER`（任意 / controller の module spec/path）

# ホットリロード（開発用ランナー）

`btuin` の raw 入力処理はプロセス全体で共有されるシングルトンを使っています。そのため、プロセス内で “remount” を繰り返すような HMR（ホットモジュールリロード）的な実装をすると、キー入力ハンドラが積み上がって入力が二重に届くなどの問題が起きます。

そこで現状は、開発時のホットリロードは **プロセスを再起動する方式（dev runner）** を推奨します。変更検知で同じターミナル上で TUI を再実行するだけです。

## CLI

```bash
btuin dev <entry> [options] [-- <args...>]
```

例:

```bash
btuin dev examples/devtools.ts
btuin dev src/main.ts --watch src --watch examples
btuin dev src/main.ts -- --foo bar
```

主なオプション:

- `--watch <path>`（複数指定可）
- `--debounce <ms>`（デフォルト: `50`）
- `--cwd <path>`（デフォルト: `process.cwd()`）
- `--no-tcp`（TCP リロードトリガー無効化）
- `--tcp-host <host>`（デフォルト: `127.0.0.1`）
- `--tcp-port <port>`（デフォルト: `0`）

## TCPトリガ（任意）

`btuin dev` はデフォルトで TCP を有効化（ポートは自動選択）します。

別ターミナルからトリガ:

```bash
printf 'reload\n' | nc 127.0.0.1 <port>
```

JSONLでもOK:

```bash
printf '{"type":"reload"}\n' | nc 127.0.0.1 <port>
```

注意: ホットリロードは `btuin dev`（dev runner）が適用します。
