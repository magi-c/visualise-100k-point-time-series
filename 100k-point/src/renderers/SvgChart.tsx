import type { ChartProps } from '../lib/types'
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  PLOT_BOTTOM,
  PLOT_LEFT,
  PLOT_RIGHT,
  getVisibleRange,
  getYTicks,
  scaleX,
  scaleY,
} from '../lib/scale'

function formatPrice(value: number): string {
  return `$${value.toFixed(0)}`
}

export function SvgChart({ data, viewport }: ChartProps) {
  const { start, end } = getVisibleRange(data.values.length, viewport)
  const path = new Array<string>(end - start)

  for (let index = start; index < end; index += 1) {
    const command = index === start ? 'M' : 'L'
    path[index - start] =
      `${command}${scaleX(index, viewport).toFixed(2)},` +
      `${scaleY(data.values[index], data.extent).toFixed(2)}`
  }

  const yTicks = getYTicks(data.extent)

  return (
    <svg
      className="chart-svg"
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label="100,000-point time series rendered as an SVG path"
    >
      {yTicks.map((tick) => {
        const y = scaleY(tick, data.extent)
        return (
          <g key={tick}>
            <line
              x1={PLOT_LEFT}
              x2={PLOT_RIGHT}
              y1={y}
              y2={y}
              className="chart-gridline"
            />
            <text x={PLOT_LEFT - 10} y={y + 4} className="chart-label" textAnchor="end">
              {formatPrice(tick)}
            </text>
          </g>
        )
      })}
      <line
        x1={PLOT_LEFT}
        x2={PLOT_RIGHT}
        y1={PLOT_BOTTOM}
        y2={PLOT_BOTTOM}
        className="chart-axis"
      />
      <path d={path.join('')} className="chart-line chart-line-svg" />
      <text x={PLOT_LEFT} y={CHART_HEIGHT - 12} className="chart-label">
        {Math.round(viewport.xMin).toLocaleString()}
      </text>
      <text
        x={PLOT_RIGHT}
        y={CHART_HEIGHT - 12}
        className="chart-label"
        textAnchor="end"
      >
        {Math.round(viewport.xMax).toLocaleString()}
      </text>
    </svg>
  )
}
