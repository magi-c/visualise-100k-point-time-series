import type { ChartProps } from '../lib/types'
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  PLOT_BOTTOM,
  PLOT_LEFT,
  PLOT_HEIGHT,
  PLOT_RIGHT,
  PLOT_TOP,
  PLOT_WIDTH,
  getDrawRange,
  getYTicks,
  scaleX,
  scaleY,
} from '../lib/scale'

// Only one SvgChart is mounted at a time, so a fixed id is safe.
const PLOT_CLIP_ID = 'svg-plot-clip'

export function SvgChart({ data, viewport }: ChartProps) {
  const { start, end } = getDrawRange(data.values.length, viewport)
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
      <defs>
        <clipPath id={PLOT_CLIP_ID}>
          <rect x={PLOT_LEFT} y={PLOT_TOP} width={PLOT_WIDTH} height={PLOT_HEIGHT} />
        </clipPath>
      </defs>
      {yTicks.map((tick) => {
        const y = scaleY(tick.value, data.extent)
        return (
          <g key={tick.value}>
            <line
              x1={PLOT_LEFT}
              x2={PLOT_RIGHT}
              y1={y}
              y2={y}
              className="chart-gridline"
            />
            <text x={PLOT_LEFT - 10} y={y + 4} className="chart-label" textAnchor="end">
              {tick.label}
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
      <path
        d={path.join('')}
        className="chart-line chart-line-svg"
        clipPath={`url(#${PLOT_CLIP_ID})`}
      />
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
