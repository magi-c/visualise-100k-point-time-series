import { FrameRecorder } from './frameRecorder'
import { panViewport, zoomViewport } from '../lib/scale'
import type { DataExtent, Viewport } from '../lib/types'

interface BenchmarkOptions {
  initialViewport: Viewport
  extent: DataExtent
  durationMs: number
  onViewportChange: (viewport: Viewport) => void
}

export function runBenchmark({
  initialViewport,
  extent,
  durationMs,
  onViewportChange,
}: BenchmarkOptions): Promise<ReturnType<FrameRecorder['getResult']>> {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return Promise.reject(new RangeError('Benchmark duration must be positive.'))
  }

  return new Promise((resolve) => {
    const recorder = new FrameRecorder()
    const startTime = performance.now()
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      window.clearTimeout(timeoutId)
      resolve(recorder.getResult(durationMs))
    }
    const timeoutId = window.setTimeout(finish, durationMs + 1_000)

    const tick = (timestamp: number) => {
      if (finished) return
      recorder.record(timestamp)
      const progress = Math.min(1, (timestamp - startTime) / durationMs)
      const phase = progress * Math.PI * 6
      const zoomFactor = 0.16 + ((Math.sin(phase) + 1) / 2) * 0.76
      const anchor = 0.5 + Math.sin(phase * 0.7) * 0.32
      const zoomed = zoomViewport(initialViewport, zoomFactor, anchor, extent)
      const offset =
        Math.sin(phase * 1.4) *
        (extent.xMax - extent.xMin) *
        0.08

      onViewportChange(
        panViewport(zoomed, offset, extent),
      )

      if (progress >= 1) {
        finish()
      } else {
        requestAnimationFrame(tick)
      }
    }

    requestAnimationFrame(tick)
  })
}
