import { useLayoutEffect, useRef } from 'react'
import type { ChartProps } from '../lib/types'
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  PLOT_BOTTOM,
  PLOT_LEFT,
  PLOT_RIGHT,
  PLOT_TOP,
  PLOT_WIDTH,
  getDrawRange,
  getYTicks,
  scaleX,
  scaleY,
} from '../lib/scale'

type RenderMode = 'full' | 'minmax'

function drawAxes(
  context: CanvasRenderingContext2D,
  data: ChartProps['data'],
  viewport: ChartProps['viewport'],
) {
  context.clearRect(0, 0, CHART_WIDTH, CHART_HEIGHT)
  context.font = '12px system-ui, sans-serif'
  context.textAlign = 'right'
  context.textBaseline = 'middle'
  context.fillStyle = '#8b94a5'

  for (const tick of getYTicks(data.extent)) {
    const y = scaleY(tick.value, data.extent)
    context.beginPath()
    context.strokeStyle = '#263247'
    context.lineWidth = 1
    context.moveTo(PLOT_LEFT, y)
    context.lineTo(PLOT_RIGHT, y)
    context.stroke()
    context.fillText(tick.label, PLOT_LEFT - 10, y)
  }

  context.beginPath()
  context.strokeStyle = '#3a465b'
  context.moveTo(PLOT_LEFT, PLOT_BOTTOM)
  context.lineTo(PLOT_RIGHT, PLOT_BOTTOM)
  context.stroke()

  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'
  context.fillText(
    Math.round(viewport.xMin).toLocaleString(),
    PLOT_LEFT,
    CHART_HEIGHT - 12,
  )
  context.textAlign = 'right'
  context.fillText(
    Math.round(viewport.xMax).toLocaleString(),
    PLOT_RIGHT,
    CHART_HEIGHT - 12,
  )
}

interface BucketBuffers {
  minValues: Float64Array
  maxValues: Float64Array
  minIndices: Int32Array
  maxIndices: Int32Array
}

// Reused between frames so min/max drawing allocates nothing per frame.
let bucketBuffers: BucketBuffers | null = null

function getBucketBuffers(bucketCount: number): BucketBuffers {
  if (!bucketBuffers || bucketBuffers.minValues.length !== bucketCount) {
    bucketBuffers = {
      minValues: new Float64Array(bucketCount),
      maxValues: new Float64Array(bucketCount),
      minIndices: new Int32Array(bucketCount),
      maxIndices: new Int32Array(bucketCount),
    }
  }
  bucketBuffers.minValues.fill(Infinity)
  bucketBuffers.maxValues.fill(-Infinity)
  return bucketBuffers
}

function drawMinMax(
  context: CanvasRenderingContext2D,
  values: Float64Array,
  viewport: ChartProps['viewport'],
  yMin: number,
  yMax: number,
  start: number,
  end: number,
) {
  const bucketCount = Math.ceil(PLOT_WIDTH)
  const { minValues, maxValues, minIndices, maxIndices } =
    getBucketBuffers(bucketCount)
  const span = viewport.xMax - viewport.xMin

  for (let index = start; index < end; index += 1) {
    // Clamp both ends: the draw range includes one point outside each edge.
    const bucket = Math.max(
      0,
      Math.min(
        bucketCount - 1,
        Math.floor(((index - viewport.xMin) / span) * bucketCount),
      ),
    )
    const value = values[index]
    if (value < minValues[bucket]) {
      minValues[bucket] = value
      minIndices[bucket] = index
    }
    if (value > maxValues[bucket]) {
      maxValues[bucket] = value
      maxIndices[bucket] = index
    }
  }

  const extent = { xMin: 0, xMax: 0, yMin, yMax }
  let hasPoint = false

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    if (minValues[bucket] === Infinity) continue

    const firstIndex = Math.min(minIndices[bucket], maxIndices[bucket])
    const secondIndex = Math.max(minIndices[bucket], maxIndices[bucket])
    const firstValue =
      minIndices[bucket] < maxIndices[bucket]
        ? minValues[bucket]
        : maxValues[bucket]
    const secondValue =
      minIndices[bucket] < maxIndices[bucket]
        ? maxValues[bucket]
        : minValues[bucket]
    const firstX = scaleX(firstIndex, viewport)
    const firstY = scaleY(firstValue, extent)
    const secondX = scaleX(secondIndex, viewport)
    const secondY = scaleY(secondValue, extent)

    if (!hasPoint) {
      context.moveTo(firstX, firstY)
      hasPoint = true
    } else {
      context.lineTo(firstX, firstY)
    }
    if (secondIndex !== firstIndex) context.lineTo(secondX, secondY)
  }
}

export function drawCanvasChart(
  context: CanvasRenderingContext2D,
  data: ChartProps['data'],
  viewport: ChartProps['viewport'],
  mode: RenderMode,
) {
  drawAxes(context, data, viewport)
  const { start, end } = getDrawRange(data.values.length, viewport)

  context.save()
  context.beginPath()
  context.rect(PLOT_LEFT, PLOT_TOP, PLOT_WIDTH, PLOT_BOTTOM - PLOT_TOP)
  context.clip()
  context.beginPath()
  context.lineWidth = 1.5
  context.strokeStyle = '#59d6b3'

  if (mode === 'full') {
    for (let index = start; index < end; index += 1) {
      const x = scaleX(index, viewport)
      const y = scaleY(data.values[index], data.extent)
      if (index === start) context.moveTo(x, y)
      else context.lineTo(x, y)
    }
  } else {
    drawMinMax(
      context,
      data.values,
      viewport,
      data.extent.yMin,
      data.extent.yMax,
      start,
      end,
    )
  }

  context.stroke()
  context.restore()
}

export function useCanvasChart(
  data: ChartProps['data'],
  viewport: ChartProps['viewport'],
  mode: RenderMode,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Layout effect: draw before the browser paints, so no frame shows a stale chart.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) {
      throw new Error('Unable to initialize the chart canvas.')
    }

    const pixelRatio = window.devicePixelRatio || 1
    const width = Math.round(CHART_WIDTH * pixelRatio)
    const height = Math.round(CHART_HEIGHT * pixelRatio)
    // Assigning width/height reallocates and clears the backing store,
    // so only do it when the size actually changes.
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    drawCanvasChart(context, data, viewport, mode)
  }, [data, mode, viewport])

  return canvasRef
}
