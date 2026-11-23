import type { ChartProps } from '../lib/types'
import { useCanvasChart } from './canvasDrawing'

export function CanvasChart(props: ChartProps) {
  const canvasRef = useCanvasChart(props.data, props.viewport, 'full')

  return (
    <canvas
      ref={canvasRef}
      className="chart-canvas"
      style={{ width: '100%', height: 'auto' }}
      aria-label="100,000-point time series rendered with Canvas"
      role="img"
    />
  )
}
