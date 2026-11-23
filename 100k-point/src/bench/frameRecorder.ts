import type { BenchmarkResult } from '../lib/types'

const FRAME_BUDGET_MS = 1000 / 60
// vsync jitter makes on-time frames read as ~16.8 ms; don't count those.
const BUDGET_TOLERANCE_MS = 1

export class FrameRecorder {
  private readonly frameTimes: number[] = []
  private previousTimestamp: number | null = null
  private firstTimestamp: number | null = null
  private longTasks = 0
  private readonly observer: PerformanceObserver | null

  constructor() {
    this.observer = this.observeLongTasks()
  }

  private observeLongTasks(): PerformanceObserver | null {
    try {
      const observer = new PerformanceObserver((list) => {
        this.longTasks += list.getEntries().length
      })
      observer.observe({ type: 'longtask', buffered: false })
      return observer
    } catch {
      return null // Long Tasks API not supported (Firefox, Safari)
    }
  }

  record(timestamp: number): void {
    if (this.firstTimestamp === null) this.firstTimestamp = timestamp
    if (this.previousTimestamp !== null) {
      this.frameTimes.push(timestamp - this.previousTimestamp)
    }
    this.previousTimestamp = timestamp
  }

  getResult(): BenchmarkResult {
    this.observer?.disconnect()
    const sorted = [...this.frameTimes].sort((a, b) => a - b)
    const meanFrameTimeMs =
      sorted.length === 0
        ? 0
        : sorted.reduce((total, frameTime) => total + frameTime, 0) /
          sorted.length
    const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1)
    const durationMs =
      this.firstTimestamp === null || this.previousTimestamp === null
        ? 0
        : this.previousTimestamp - this.firstTimestamp

    return {
      durationMs,
      frameCount: sorted.length,
      fps: meanFrameTimeMs === 0 ? 0 : 1000 / meanFrameTimeMs,
      meanFrameTimeMs,
      p95FrameTimeMs: sorted[p95Index] ?? 0,
      maxFrameTimeMs: sorted[sorted.length - 1] ?? 0,
      framesOverBudget: sorted.filter(
        (frameTime) => frameTime > FRAME_BUDGET_MS + BUDGET_TOLERANCE_MS,
      ).length,
      longTasks: this.longTasks,
      heapMB: readHeapMB(),
    }
  }
}

/** Chromium-only, non-standard and coarse; null in other browsers. */
function readHeapMB(): number | null {
  const memory = (
    performance as Performance & { memory?: { usedJSHeapSize: number } }
  ).memory
  return memory ? memory.usedJSHeapSize / 1_048_576 : null
}
