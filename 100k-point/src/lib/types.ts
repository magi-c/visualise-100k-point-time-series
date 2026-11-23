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
}
