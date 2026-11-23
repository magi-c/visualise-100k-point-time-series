import type { DataExtent, Viewport } from './types'

export const CHART_WIDTH = 1000
export const CHART_HEIGHT = 300
export const PLOT_LEFT = 64
export const PLOT_RIGHT = 984
export const PLOT_TOP = 18
export const PLOT_BOTTOM = 260
export const PLOT_WIDTH = PLOT_RIGHT - PLOT_LEFT
export const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP

export function lowerBound(count: number, target: number): number {
  let low = 0
  let high = count

  while (low < high) {
    const middle = low + Math.floor((high - low) / 2)
    if (middle < target) {
      low = middle + 1
    } else {
      high = middle
    }
  }

  return low
}

export function upperBound(count: number, target: number): number {
  let low = 0
  let high = count

  while (low < high) {
    const middle = low + Math.floor((high - low) / 2)
    if (middle <= target) {
      low = middle + 1
    } else {
      high = middle
    }
  }

  return low
}

/** Exact index range of the points inside the viewport (used for the readout). */
export function getVisibleRange(
  pointCount: number,
  viewport: Viewport,
): { start: number; end: number } {
  return {
    start: lowerBound(pointCount, viewport.xMin),
    end: upperBound(pointCount, viewport.xMax),
  }
}

/**
 * Range to draw: the visible points plus one neighbour on each side, so the
 * line reaches the plot edges when zoomed in. The plot area is clipped.
 */
export function getDrawRange(
  pointCount: number,
  viewport: Viewport,
): { start: number; end: number } {
  const { start, end } = getVisibleRange(pointCount, viewport)
  return {
    start: Math.max(0, start - 1),
    end: Math.min(pointCount, end + 1),
  }
}

export function scaleX(value: number, viewport: Viewport): number {
  return (
    PLOT_LEFT +
    ((value - viewport.xMin) / (viewport.xMax - viewport.xMin)) * PLOT_WIDTH
  )
}

/** Y-domain with 6% padding above and below the data. */
export function getYDomain(extent: DataExtent): { min: number; max: number } {
  const range = extent.yMax - extent.yMin || 1
  const padding = range * 0.06
  return { min: extent.yMin - padding, max: extent.yMax + padding }
}

export function scaleY(value: number, extent: DataExtent): number {
  const { min, max } = getYDomain(extent)

  return PLOT_BOTTOM - ((value - min) / (max - min)) * PLOT_HEIGHT
}

export interface YTick {
  value: number
  label: string
}

/**
 * Round tick values (1, 2 or 5 x 10^n) inside the y-domain, labelled with
 * exactly the precision the step needs, so every label matches its gridline.
 */
export function getYTicks(extent: DataExtent, targetCount = 5): YTick[] {
  const { min, max } = getYDomain(extent)
  const rawStep = (max - min) / Math.max(1, targetCount - 1)
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const residual = rawStep / magnitude
  const multiplier =
    residual < 1.5 ? 1 : residual < 3 ? 2 : residual < 7 ? 5 : 10
  const step = multiplier * magnitude
  const decimals = Math.max(0, -Math.floor(Math.log10(step)))
  const first = Math.ceil(min / step)
  const last = Math.floor(max / step)
  const ticks: YTick[] = []

  // Top to bottom. value = i * step avoids accumulating floating-point error.
  for (let i = last; i >= first; i -= 1) {
    const value = i * step
    ticks.push({ value, label: `$${value.toFixed(decimals)}` })
  }

  return ticks
}

export function clampViewport(
  viewport: Viewport,
  extent: DataExtent,
  minSpan = 2,
): Viewport {
  const domainSpan = extent.xMax - extent.xMin
  const span = Math.min(
    domainSpan,
    Math.max(minSpan, viewport.xMax - viewport.xMin),
  )
  let xMin = viewport.xMin
  let xMax = xMin + span

  if (xMin < extent.xMin) {
    xMin = extent.xMin
    xMax = xMin + span
  }
  if (xMax > extent.xMax) {
    xMax = extent.xMax
    xMin = xMax - span
  }

  return { xMin, xMax }
}

export function zoomViewport(
  viewport: Viewport,
  factor: number,
  anchorRatio: number,
  extent: DataExtent,
): Viewport {
  const anchor = viewport.xMin + (viewport.xMax - viewport.xMin) * anchorRatio
  const span = (viewport.xMax - viewport.xMin) * factor

  return clampViewport(
    {
      xMin: anchor - span * anchorRatio,
      xMax: anchor + span * (1 - anchorRatio),
    },
    extent,
  )
}

export function panViewport(
  viewport: Viewport,
  delta: number,
  extent: DataExtent,
): Viewport {
  return clampViewport(
    { xMin: viewport.xMin + delta, xMax: viewport.xMax + delta },
    extent,
  )
}
