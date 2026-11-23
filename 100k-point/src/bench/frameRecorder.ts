import type { BenchmarkResult } from '../lib/types'

export class FrameRecorder {
  private readonly frameTimes: number[] = []
  private previousTimestamp: number | null = null
  private firstTimestamp: number | null = null

  record(timestamp: number): void {
    if (this.firstTimestamp === null) this.firstTimestamp = timestamp
    if (this.previousTimestamp !== null) {
      this.frameTimes.push(timestamp - this.previousTimestamp)
    }
    this.previousTimestamp = timestamp
  }

  getResult(fallbackDurationMs = 0): BenchmarkResult {
    const sorted = [...this.frameTimes].sort((a, b) => a - b)
    const meanFrameTimeMs =
      sorted.length === 0
        ? 0
        : sorted.reduce((total, frameTime) => total + frameTime, 0) /
          sorted.length
    const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
    const recordedDurationMs =
      this.firstTimestamp === null || this.previousTimestamp === null
        ? 0
        : this.previousTimestamp - this.firstTimestamp

    return {
      durationMs: recordedDurationMs || fallbackDurationMs,
      frameCount: sorted.length,
      fps: meanFrameTimeMs === 0 ? 0 : 1000 / meanFrameTimeMs,
      meanFrameTimeMs,
      p95FrameTimeMs: sorted[p95Index] ?? 0,
    }
  }
}
