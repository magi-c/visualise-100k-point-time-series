import { FrameRecorder } from './frameRecorder'
import { panViewport, zoomViewport } from '../lib/scale'
import type {
  BenchmarkPhase,
  BenchmarkResult,
  DataExtent,
  Viewport,
} from '../lib/types'

interface BenchmarkOptions {
  phase: BenchmarkPhase
  extent: DataExtent
  durationMs: number
  onViewportChange: (viewport: Viewport) => void
}

/** Resolve after `count` animation frames (lets a new chart mount and paint). */
export async function waitFrames(count: number): Promise<void> {
  for (let frame = 0; frame < count; frame += 1) {
    await new Promise<number>((resolve) => requestAnimationFrame(resolve))
  }
}

/**
 * Viewport for a phase at `progress` (0..1). Always derived from the full
 * data extent, so a run doesn't depend on where the user had zoomed.
 */
function viewportAt(
  phase: BenchmarkPhase,
  progress: number,
  extent: DataExtent,
): Viewport {
  const full: Viewport = { xMin: extent.xMin, xMax: extent.xMax }

  if (phase === 'full-extent') {
    // Wobble between 98% and 100% of the data: every point stays visible,
    // but the viewport still changes each frame, forcing a redraw.
    const factor = 0.98 + 0.02 * Math.abs(Math.cos(progress * Math.PI * 8))
    return zoomViewport(full, factor, 0.5, extent)
  }

  const phaseAngle = progress * Math.PI * 6
  const zoomFactor = 0.16 + ((Math.sin(phaseAngle) + 1) / 2) * 0.76
  const anchor = 0.5 + Math.sin(phaseAngle * 0.7) * 0.32
  const zoomed = zoomViewport(full, zoomFactor, anchor, extent)
  const offset = Math.sin(phaseAngle * 1.4) * (extent.xMax - extent.xMin) * 0.08

  return panViewport(zoomed, offset, extent)
}

export function runBenchmark({
  phase,
  extent,
  durationMs,
  onViewportChange,
}: BenchmarkOptions): Promise<BenchmarkResult> {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return Promise.reject(new RangeError('Benchmark duration must be positive.'))
  }

  return new Promise((resolve) => {
    const recorder = new FrameRecorder()
    const startTime = performance.now()

    const tick = (timestamp: number) => {
      recorder.record(timestamp)
      const progress = Math.min(1, (timestamp - startTime) / durationMs)
      onViewportChange(viewportAt(phase, progress, extent))

      if (progress >= 1) {
        resolve(recorder.getResult())
      } else {
        requestAnimationFrame(tick)
      }
    }

    requestAnimationFrame(tick)
  })
}
