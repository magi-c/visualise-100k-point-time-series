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

export function getVisibleRange(
  pointCount: number,
  viewport: Viewport,
): { start: number; end: number } {
  return {
    start: lowerBound(pointCount, viewport.xMin),
    end: upperBound(pointCount, viewport.xMax),
  }
}

export function scaleX(value: number, viewport: Viewport): number {
  return (
    PLOT_LEFT +
    ((value - viewport.xMin) / (viewport.xMax - viewport.xMin)) * PLOT_WIDTH
  )
}

export function scaleY(value: number, extent: DataExtent): number {
  const range = extent.yMax - extent.yMin || 1
  const padding = range * 0.06
  const min = extent.yMin - padding
  const max = extent.yMax + padding

  return PLOT_BOTTOM - ((value - min) / (max - min)) * PLOT_HEIGHT
}

export function getYTicks(extent: DataExtent, count = 5): number[] {
  const range = extent.yMax - extent.yMin || 1
  const padding = range * 0.06
  const min = extent.yMin - padding
  const max = extent.yMax + padding

  return Array.from({ length: count }, (_, index) => {
    const ratio = index / (count - 1)
    return max - ratio * (max - min)
  })
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
