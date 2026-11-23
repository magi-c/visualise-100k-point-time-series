export interface DataExtent {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

export interface SeriesData {
  values: Float64Array
  extent: DataExtent
}

export interface Viewport {
  xMin: number
  xMax: number
}

export interface ChartProps {
  data: SeriesData
  viewport: Viewport
}

export interface BenchmarkResult {
  durationMs: number
  frameCount: number
  fps: number
  meanFrameTimeMs: number
  p95FrameTimeMs: number
  maxFrameTimeMs: number
  /** Frames longer than the 60 Hz budget (16.7 ms + 1 ms vsync tolerance). */
  framesOverBudget: number
  /** Main-thread tasks over 50 ms (Chromium only; 0 where unsupported). */
  longTasks: number
  /** Used JS heap after the run (Chromium only, coarse); null elsewhere. */
  heapMB: number | null
}

/**
 * full-extent: all 100k points stay visible (worst case).
 * zoom-pan: scripted zoom and pan, starting from the full extent.
 */
export type BenchmarkPhase = 'full-extent' | 'zoom-pan'
