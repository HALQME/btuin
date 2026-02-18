# Layout Engine

高性能Zig製FlexBoxレイアウトエンジン。

## 特徴

- **高性能**: Zigによるゼロコスト抽象化
- **軽量**: リリースビルド約70KB
- **FFI互換**: C ABIでTypeScriptから直接呼び出し
- **TUI最適化**: ターミナルUI向けの計算最適化

## ビルド

```bash
# 現在のプラットフォーム向けにビルド
build-ffi

# 全プラットフォーム向けにビルド
build-ffi-all

# テスト実行
test-ffi

# ベンチマーク
bench-ffi
```

## FFI API

### ライフサイクル

```c
// エンジン作成
void* le_create();

// エンジン破棄
void le_destroy(void* engine);

// バージョン取得
uint32_t le_version();
```

### レイアウト計算

```c
// レイアウト計算
int32_t le_compute(
    void* engine,
    const float* style_buffer,     // スタイルデータ
    size_t style_buffer_len,       // バッファサイズ
    const uint32_t* children_buffer, // 子ノードインデックス
    size_t children_buffer_len,    // 子バッファサイズ
    uint32_t node_count,           // ノード数
    float available_width,         // 使用可能幅
    float available_height         // 使用可能高さ
);

// 結果取得
const float* le_get_results_ptr(void* engine);
size_t le_get_results_len(void* engine);
```

### スタイルバッファフォーマット

1ノード = 32 floats (STYLE_STRIDE)

| Index | Property | Values |
|-------|----------|--------|
| 0 | Display | 0=Flex, 1=None |
| 1 | PositionType | 0=Relative, 1=Absolute |
| 2 | FlexDirection | 0=Row, 1=Column, 2=RowReverse, 3=ColumnReverse |
| 3 | JustifyContent | 0=Start, 1=End, 2=Center, 3=SpaceBetween, 4=SpaceAround, 5=SpaceEvenly |
| 4 | AlignItems | 0=Stretch, 1=Start, 2=End, 3=Center |
| 5 | AlignSelf | 0=Auto, 1=Start, 2=End, 3=Center, 4=Stretch |
| 6 | FlexGrow | float |
| 7 | FlexShrink | float |
| 8 | Width | positive=points, negative=percent, NaN=auto |
| 9 | Height | positive=points, negative=percent, NaN=auto |
| 10 | MinWidth | positive=points, negative=percent |
| 11 | MinHeight | positive=points, negative=percent |
| 12 | MaxWidth | positive=points, negative=percent |
| 13 | MaxHeight | positive=points, negative=percent |
| 14 | GapRow | float |
| 15 | GapColumn | float |
| 16-19 | Padding | Top, Right, Bottom, Left |
| 20-23 | Margin | Top, Right, Bottom, Left |
| 24 | ChildrenCount | uint32 as float |
| 25 | ChildrenOffset | uint32 as float |
| 26-31 | Reserved | - |

### 結果フォーマット

1ノード = 5 floats (RESULT_STRIDE)

```
[node_id, x, y, width, height, ...]
```

## アーキテクチャ

```
┌─────────────────────────────────────┐
│          TypeScript Layer           │
│  (packages/core/src/layout-engine/) │
├─────────────────────────────────────┤
│           FFI (bun:ffi)             │
├─────────────────────────────────────┤
│       Zig Layout Engine             │
│  (packages/core/src/layout-engine/) │
│  - SIMD-friendly data layout        │
│  - Single-pass layout algorithm     │
│  - Minimal allocations              │
└─────────────────────────────────────┘
```

## パフォーマンス

ベンチマーク結果（M1 Mac, ReleaseFast）:

```
Nodes: 1000
Iterations: 1000
Total time: ~50ms
Average per layout: ~0.05ms
Layouts per second: ~20000
```

## テスト

```bash
cd packages/core/src/layout-engine
zig build test
```

テストカバレッジ:
- 基本レイアウト計算（Row/Column）
- Dimensionパース（Points/Percent/Auto）
- Constraint適用（Min/Max）
