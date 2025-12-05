import { describe, it, beforeEach, afterEach, expect } from "bun:test";
import {
  createBuffer,
  cloneBuffer,
  renderDiff,
  drawText,
  type Buffer2D,
} from "../packages/btuin/src/buffer";
import { interceptTTY } from "../packages/btuin/tests/helpers/tty";
import { Profiler } from "./profiler-core";

/**
* IO profiling for btuin:
 *
 * - Diff rendering write pattern（フルレンダー vs 微小差分での出力量の差を検査）
 * - 重い処理 + IO 時のフレーム時間分布（60FPS/30FPS への影響を見る）
 *
 * ここでは「TTYそのもののスループット」を測るのではなく、
 * 「renderDiff + heavy workload の組み合わせ」がどこからフレームレートを壊し始めるか、
 * また diff レンダラが bytes / writes をきちんと抑制できているかを確認する。
 */

function syncBuffer(dst: Buffer2D, src: Buffer2D) {
  dst.cells.set(src.cells);
  for (let idx = 0; idx < dst.cells.length; idx++) {
    dst.fg[idx] = src.fg[idx];
    dst.bg[idx] = src.bg[idx];
  }
}

describe("IO profiling – diff rendering and heavy workload with IO", () => {
  let profiler: Profiler;

  beforeEach(() => {
    Bun.gc(true);
    profiler = new Profiler();
  });

  afterEach(() => {
    // 各テストの最後に詳細レポートを出す（開発者向けの補助情報）
    profiler.report();
  });

  describe("diff rendering write pattern", () => {
    /**
     * フルレンダーと、1セルだけの微小差分レンダーを比較し、
     * - 微小差分時の出力量(bytes)がフルレンダーより十分小さいこと
     * - 1フレームあたりの write 回数が常識的な範囲に収まっていること
     * を検証する。
     *
     * Note:
     *  - 現時点の capture 実装は合計出力文字列のみを保持しているため、
     *    「writes 回数」までは測定していない。
     *  - そのため、このテストでは bytes（=出力文字数）の比率に注目する。
     *  - 将来的に write 回数を追跡したくなった場合は、`capture` 側に
     *    メタ情報（write 呼び出し回数）を追加して拡張する余地がある。
     */
    it("emits far fewer bytes on tiny diffs than on full renders", () => {
      let activeTTY: ReturnType<typeof interceptTTY> | null = null;

      try {
        // フルレンダー計測
        activeTTY = interceptTTY();
        const prevFull = createBuffer(24, 80);
        const nextFull = cloneBuffer(prevFull);

        // 全画面にある程度のテキストを描画して「フルレンダー」相当の負荷をつくる
        for (let r = 0; r < 24; r++) {
          drawText(nextFull, r, 0, `Full render line ${r.toString().padStart(2, "0")}`);
        }

        profiler.measure("full render (renderDiff)", () => {
          renderDiff(prevFull, nextFull);
        });

        const fullOutput = activeTTY.output();
        const fullBytes = fullOutput.length;

        // 安全のため一旦キャプチャをクリア
        activeTTY.clear();

        // 微小差分レンダー計測
        const prevTiny = cloneBuffer(nextFull);
        const nextTiny = cloneBuffer(prevTiny);

        // 1セルだけ変更（微小な diff）
        drawText(nextTiny, 0, 0, "X"); // 先頭セルを "X" に変更

        profiler.measure("tiny diff render (renderDiff)", () => {
          renderDiff(prevTiny, nextTiny);
        });

        const tinyOutput = activeTTY.output();
        const tinyBytes = tinyOutput.length;

        // bytes 比を検証:
        // tinyDiff の bytes はフルレンダーより十分小さい（20% 未満）ことを期待。
        // （実装や端末制御コードの量によっては、少し調整が必要かもしれない）
        expect(fullBytes).toBeGreaterThan(0);
        expect(tinyBytes).toBeGreaterThan(0);
        expect(tinyBytes).toBeLessThan(fullBytes * 0.2);
      } finally {
        if (activeTTY) {
          activeTTY.restore();
          activeTTY = null;
        }
      }
    });
  });

  describe("heavy workload + IO frame timing", () => {
    /**
     * 「重めのCPU処理 + renderDiff によるTTY IO」を複数フレーム繰り返し、
     * フレーム時間の P99 が 60FPS / 30FPS の目標値にどう影響するかを検証する。
     *
     * ここではレンダリング/IO自体の詳細な最適化ではなく、
     * 「この程度の CPU 負荷 + IO であれば、実用上のフレームレートは保てる」
     * という感覚的なブレークポイントをテストとして残すことが目的。
     */

    function syntheticWorkload(kind: "light" | "medium" | "heavy") {
      const size =
        kind === "light" ? 1_000
        : kind === "medium" ? 10_000
        : 50_000;

      const arr = Array.from({ length: size }, (_, i) => Math.sin(i));
      arr.sort();
      JSON.stringify(arr);
    }

    it("keeps P99 frame time < 16.67ms for medium workload + IO", () => {
      let activeTTY: ReturnType<typeof interceptTTY> | null = null;

      try {
        activeTTY = interceptTTY();

        const prev = createBuffer(24, 80);
        const next = cloneBuffer(prev);

        // フレーム毎に多少内容が変わるよう、行ごとにテキストを描画
        const frameCount = 120; // おおよそ2秒分 (60FPS想定)

        profiler.measureFrames(
          "medium workload + renderDiff + IO",
          (frame: number) => {
            // 次フレームの内容を更新
            for (let r = 0; r < 24; r++) {
              drawText(
                next,
                r,
                0,
                `Frame ${frame.toString().padStart(3, "0")} row ${r
                  .toString()
                  .padStart(2, "0")}`,
              );
            }

            // medium なCPU負荷
            syntheticWorkload("medium");

            // renderDiff により TTY IO を発生させる
            renderDiff(prev, next);

            // prev を next 状態に同期
            syncBuffer(prev, next);

            // 出力はテスト用キャプチャに only で流れる。
            // 実際のTTY速度はここでは測っていない。
          },
          frameCount,
        );

        const metrics = profiler
          .getMetrics()
          .filter((m: any) => m.name.startsWith("medium workload + renderDiff + IO"));

        expect(metrics.length).toBeGreaterThan(0);
        const metric = metrics[metrics.length - 1];

        if (metric?.p99Duration !== undefined) {
          // medium workload であれば、60FPS(16.67ms)の P99 を維持できることを期待。
          expect(metric.p99Duration).toBeLessThan(16.67);
        }
      } finally {
        if (activeTTY) {
          activeTTY.restore();
          activeTTY = null;
        }
      }
    });

    it("keeps P99 frame time < 33.3ms for heavy workload + IO", () => {
      let activeTTY: ReturnType<typeof interceptTTY> | null = null;

      try {
        activeTTY = interceptTTY();

        const prev = createBuffer(24, 80);
        const next = cloneBuffer(prev);

        const frameCount = 120; // おおよそ2秒分

        profiler.measureFrames(
          "heavy workload + renderDiff + IO",
          (frame: number) => {
            // heavy ケースでは、より多くのテキストを描画してレンダリング負荷を上げる
            for (let r = 0; r < 24; r++) {
              drawText(
                next,
                r,
                0,
                `HEAVY Frame ${frame.toString().padStart(3, "0")} row ${r
                  .toString()
                  .padStart(2, "0")} ##########`,
              );
            }

            syntheticWorkload("heavy");

            renderDiff(prev, next);
            syncBuffer(prev, next);
          },
          frameCount,
        );

        const metrics = profiler
          .getMetrics()
          .filter((m: any) => m.name.startsWith("heavy workload + renderDiff + IO"));

        expect(metrics.length).toBeGreaterThan(0);
        const metric = metrics[metrics.length - 1];

        if (metric?.p99Duration !== undefined) {
          // heavy workload では 60FPS は諦め、30FPS (33.3ms) を下限SLOとする。
          expect(metric.p99Duration).toBeLessThan(33.34);
        }
      } finally {
        if (activeTTY) {
          activeTTY.restore();
          activeTTY = null;
        }
      }
    });
  });
});
