import type { Buffer2D } from "../packages/renderer/src/types/buffer";

/**
 * Performance profiler core for btuin package.
 *
 * - CPU時間・メモリ使用量の計測
 * - フレーム単位の計測（P95/P99）
 * - フラグメンテーション／スケーラビリティ測定
 *
 * このモジュールはテストやスクリプトから再利用される「コアロジック」として切り出されており、
 * 実際のプロファイリングシナリオは `scripts/profiler.spec.ts` や
 * `scripts/profiler.io.spec.ts` 側で定義する。
 */

/**
 * プロファイルメトリクス（1つの測定単位ごと）
 */
export interface ProfileMetrics {
  name: string;
  duration: number;
  memoryBefore?: number;
  memoryAfter?: number;
  memoryDelta?: number;
  peakMemory?: number;
  operationCount: number;
  opsPerSecond: number;
  memoryEfficiency?: number; // ops per MB
  p99Duration?: number;
  p95Duration?: number;
}

/**
 * フレーム単位メトリクス
 */
export interface FrameMetrics {
  frameNumber: number;
  duration: number;
  timestamp: number;
}

/**
 * プロファイラ全体の集約統計。
 * 1回のプロファイル実行内での分布やホットスポットを俯瞰するために使う。
 */
export interface ProfilerSummary {
  // 時間系（全メトリクスの duration 分布）
  totalDuration: number;
  meanDuration: number;
  medianDuration: number;
  p95Duration: number;
  p99Duration: number;

  // メモリ系
  peakMemory: number;
  totalPositiveMemoryDelta: number;
  totalNegativeMemoryDelta: number;

  // ホットスポット（上位N件）
  topByDuration: ProfileMetrics[];
  topByMemoryDelta: ProfileMetrics[];

  // フレーム統計（measureFrames が使われた場合のみ）
  frameStats?: {
    count: number;
    mean: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  };
}

/**
 * btuin 向け汎用プロファイラコア。
 *
 * - できるだけ「計測ロジック」に責務を絞る
 * - 実際に何を計測するか（List, BufferPool, IO など）は呼び出し側に委ねる
 */
export class Profiler {
  private metrics: ProfileMetrics[] = [];
  private frameMetrics: FrameMetrics[] = [];
  private peakMemoryUsage: number = 0;

  /**
   * 任意の関数の実行時間とメモリ使用量を計測する。
   */
  measure(
    name: string,
    fn: () => void,
    operationCount: number = 1,
  ): ProfileMetrics {
    const memBefore = process.memoryUsage();
    const start = performance.now();

    fn();

    const end = performance.now();
    const memAfter = process.memoryUsage();
    const duration = end - start;
    const opsPerSecond = (operationCount / duration) * 1000;

    const memoryDelta = memAfter.heapUsed - memBefore.heapUsed;
    const peakMemory = Math.max(this.peakMemoryUsage, memAfter.heapUsed);
    this.peakMemoryUsage = peakMemory;

    const memoryEfficiency =
      memoryDelta > 0
        ? operationCount / (memoryDelta / 1024 / 1024)
        : undefined;

    const metric: ProfileMetrics = {
      name,
      duration,
      memoryBefore: memBefore.heapUsed,
      memoryAfter: memAfter.heapUsed,
      memoryDelta,
      peakMemory,
      operationCount,
      opsPerSecond,
      memoryEfficiency,
    };

    this.metrics.push(metric);
    return metric;
  }

  /**
   * フレームループ（レンダリングシミュレーション）の計測。
   *
   * - 各フレームの duration を記録
   * - P95/P99 フレーム時間を集計
   */
  measureFrames(
    name: string,
    fn: (frameNumber: number) => void,
    frameCount: number = 60,
  ): FrameMetrics[] {
    const frames: FrameMetrics[] = [];
    const startTime = performance.now();

    for (let i = 0; i < frameCount; i++) {
      const frameStart = performance.now();
      fn(i);
      const frameEnd = performance.now();
      const duration = frameEnd - frameStart;

      frames.push({
        frameNumber: i,
        duration,
        timestamp: frameStart - startTime,
      });
    }

    const totalDuration = frames.reduce((sum, f) => sum + f.duration, 0);

    const metric: ProfileMetrics = {
      name: `${name} (frame simulation)`,
      duration: totalDuration,
      operationCount: frameCount,
      opsPerSecond: (frameCount / totalDuration) * 1000,
      p99Duration: this.calculatePercentile(
        frames.map((f) => f.duration),
        99,
      ),
      p95Duration: this.calculatePercentile(
        frames.map((f) => f.duration),
        95,
      ),
    };

    this.metrics.push(metric);
    this.frameMetrics.push(...frames);

    return frames;
  }

  /**
   * バッファのアロケーション/デアロケーションを複数サイクル実行し、
   * フラグメンテーションパターンとメモリ変化を測定する。
   */
  measureFragmentation(
    name: string,
    allocFn: () => Buffer2D[],
    deallocFn: (buffers: Buffer2D[]) => void,
    cycles: number = 100,
  ): ProfileMetrics {
    const memBefore = process.memoryUsage();
    const start = performance.now();

    for (let i = 0; i < cycles; i++) {
      const buffers = allocFn();
      deallocFn(buffers);
    }

    const end = performance.now();
    const memAfter = process.memoryUsage();
    const duration = end - start;
    const opsPerSecond = (cycles / duration) * 1000;

    const memoryDelta = memAfter.heapUsed - memBefore.heapUsed;
    const peakMemory = Math.max(this.peakMemoryUsage, memAfter.heapUsed);
    this.peakMemoryUsage = peakMemory;

    const metric: ProfileMetrics = {
      name: `${name} (fragmentation test)`,
      duration,
      memoryBefore: memBefore.heapUsed,
      memoryAfter: memAfter.heapUsed,
      memoryDelta,
      peakMemory,
      operationCount: cycles,
      opsPerSecond,
    };

    this.metrics.push(metric);
    return metric;
  }

  /**
   * データサイズを変化させながらスケーラビリティを測定する。
   *
   * 1サイズにつき1回実行し、その duration / ops/sec / memoryDelta を記録する。
   */
  measureScalability(
    name: string,
    fn: (size: number) => void,
    sizes: number[],
  ): void {
    for (const size of sizes) {
      const memBefore = process.memoryUsage();
      const start = performance.now();

      fn(size);

      const end = performance.now();
      const memAfter = process.memoryUsage();
      const duration = end - start;

      const memoryDelta = memAfter.heapUsed - memBefore.heapUsed;
      const peakMemory = Math.max(this.peakMemoryUsage, memAfter.heapUsed);
      this.peakMemoryUsage = peakMemory;

      const metric: ProfileMetrics = {
        name: `${name} (size: ${size})`,
        duration,
        memoryBefore: memBefore.heapUsed,
        memoryAfter: memAfter.heapUsed,
        memoryDelta,
        peakMemory,
        operationCount: 1,
        opsPerSecond: (1 / duration) * 1000,
      };

      this.metrics.push(metric);
    }
  }

  /**
   * 単純なパーセンタイル計算（昇順ソート → インデックス計算）。
   */
  private calculatePercentile(
    values: number[],
    percentile: number,
  ): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)]!;
  }

  /**
   * 人間向けの簡易レポートを stdout に出力する。
   *
   * - 各メトリクスの duration / ops/sec / メモリ情報
   * - P95/P99（存在する場合）
   * - 全体時間および最も遅いメトリクス名
   * - 追加で、集約統計（summary）も表示する
   */
  report(): void {
    if (this.metrics.length === 0) return;

    let totalTime = 0;
    for (const metric of this.metrics) {
      totalTime += metric.duration;
    }

    for (const metric of this.metrics) {
      const percentage =
        totalTime > 0
          ? ((metric.duration / totalTime) * 100).toFixed(1)
          : "0.0";
      console.log(`📊 ${metric.name}`);
      console.log(
        `   Duration: ${metric.duration.toFixed(2)}ms (${percentage}% of total)`,
      );
      console.log(`   Operations: ${metric.operationCount}`);
      console.log(`   Ops/sec: ${metric.opsPerSecond.toFixed(0)}`);

      if (metric.memoryDelta !== undefined && metric.memoryDelta !== 0) {
        const sign = metric.memoryDelta >= 0 ? "+" : "";
        console.log(
          `   Memory Δ: ${sign}${(
            metric.memoryDelta /
            1024 /
            1024
          ).toFixed(2)}MB`,
        );
      }

      if (metric.memoryEfficiency !== undefined) {
        console.log(
          `   Memory Efficiency: ${metric.memoryEfficiency.toFixed(
            0,
          )} ops/MB`,
        );
      }

      if (metric.p99Duration !== undefined) {
        console.log(
          `   P99 Frame Time: ${metric.p99Duration.toFixed(
            2,
          )}ms (tail latency)`,
        );
      }

      if (metric.p95Duration !== undefined) {
        console.log(
          `   P95 Frame Time: ${metric.p95Duration.toFixed(
            2,
          )}ms (95th percentile)`,
        );
      }

      console.log();
    }

    if (this.peakMemoryUsage > 0) {
      console.log(
        `📈 Peak Memory Usage: ${(
          this.peakMemoryUsage /
          1024 /
          1024
        ).toFixed(2)}MB`,
      );
    }

    console.log(`⏱️  Total Time: ${totalTime.toFixed(2)}ms`);
    const slowest = this.getSlowest();
    console.log(`🔥 Hotspot: ${slowest?.name || "N/A"}`);
    console.log();

  }

  /**
   * 最も遅いメトリクスを返す。
   */
  getSlowest(): ProfileMetrics | null {
    if (this.metrics.length === 0) return null;
    return this.metrics.reduce((prev, curr) =>
      curr.duration > prev.duration ? curr : prev,
    );
  }

  /**
   * duration 降順にソートしたメトリクス一覧を返す。
   */
  getSorted(): ProfileMetrics[] {
    return [...this.metrics].sort((a, b) => b.duration - a.duration);
  }

  /**
   * 全メトリクスをコピーで返す。
   */
  getMetrics(): ProfileMetrics[] {
    return [...this.metrics];
  }

  /**
   * フレームメトリクス一覧をコピーで返す。
   */
  getFrameMetrics(): FrameMetrics[] {
    return [...this.frameMetrics];
  }

  /**
   * 記録されたピークメモリ（heapUsed）の生値を返す（バイト）。
   */
  getPeakMemory(): number {
    return this.peakMemoryUsage;
  }

  /**
   * 全メトリクスとピークメモリ情報をクリアする。
   */
  clear(): void {
    this.metrics = [];
    this.frameMetrics = [];
    this.peakMemoryUsage = 0;
  }
}
