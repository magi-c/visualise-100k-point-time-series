import { useCallback, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import {
  CHART_WIDTH,
  PLOT_LEFT,
  PLOT_WIDTH,
  clampViewport,
  panViewport,
  zoomViewport,
} from '../lib/scale'
import type { DataExtent, Viewport } from '../lib/types'

interface DragState {
  pointerId: number
  startX: number
  viewport: Viewport
}

export function useViewport(extent: DataExtent) {
  const [viewport, setViewport] = useState<Viewport>(() => ({
    xMin: extent.xMin,
    xMax: extent.xMax,
  }))
  const drag = useRef<DragState | null>(null)

  const resetViewport = useCallback(() => {
    setViewport({ xMin: extent.xMin, xMax: extent.xMax })
  }, [extent.xMax, extent.xMin])

  const onWheel = useCallback(
    (event: globalThis.WheelEvent, element: HTMLElement) => {
      event.preventDefault()
      const bounds = element.getBoundingClientRect()
      const chartX =
        ((event.clientX - bounds.left) / bounds.width) * CHART_WIDTH
      const anchorRatio = Math.min(
        1,
        Math.max(0, (chartX - PLOT_LEFT) / PLOT_WIDTH),
      )
      const factor = Math.exp(event.deltaY * 0.001)

      setViewport((current) =>
        zoomViewport(current, factor, anchorRatio, extent),
      )
    },
    [extent],
  )

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      event.currentTarget.setPointerCapture(event.pointerId)
      drag.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        viewport,
      }
    },
    [viewport],
  )

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const activeDrag = drag.current
      if (!activeDrag || activeDrag.pointerId !== event.pointerId) return
      // Button already released (e.g. pointerup was missed while input was
      // locked during a benchmark): end the drag instead of panning.
      if (event.buttons === 0) {
        drag.current = null
        return
      }

      const bounds = event.currentTarget.getBoundingClientRect()
      const delta =
        (-(event.clientX - activeDrag.startX) / bounds.width) *
        (CHART_WIDTH / PLOT_WIDTH) *
        (activeDrag.viewport.xMax - activeDrag.viewport.xMin)

      setViewport(panViewport(activeDrag.viewport, delta, extent))
    },
    [extent],
  )

  const finishDrag = useCallback((event: PointerEvent<HTMLElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  // Stable identity, so callbacks that use it can stay stable too.
  const setClampedViewport = useCallback(
    (next: Viewport) => setViewport(clampViewport(next, extent)),
    [extent],
  )

  return {
    viewport,
    setViewport: setClampedViewport,
    resetViewport,
    onWheel,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
    },
  }
}
