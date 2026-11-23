import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { runBenchmark } from './bench/runBenchmark'
import { generateSeries } from './data/generate'
import { useViewport } from './hooks/useViewport'
import { getVisibleRange } from './lib/scale'
import type { BenchmarkResult, ChartProps } from './lib/types'
import { CanvasChart } from './renderers/CanvasChart'
import { CanvasMinMaxChart } from './renderers/CanvasMinMaxChart'
import { SvgChart } from './renderers/SvgChart'
import './App.css'

const BENCHMARK_DURATION_MS = 2_000
const RENDERERS = ['svg', 'canvas', 'minmax'] as const
type Renderer = (typeof RENDERERS)[number]
type ViewportHandlers = ReturnType<typeof useViewport>['handlers']

const RENDERER_INFO: Record<
  Renderer,
  { index: string; title: string; subtitle: string; tag: string; footer: string }
> = {
  svg: {
    index: '01',
    title: 'SVG',
    subtitle: 'One vector path, every point',
    tag: 'VECTOR',
    footer: 'Scales cleanly at any size',
  },
  canvas: {
    index: '02',
    title: 'Canvas',
    subtitle: 'All visible samples drawn',
    tag: 'FULL RESOLUTION',
    footer: 'Direct 2D context rendering',
  },
  minmax: {
    index: '03',
    title: 'Canvas Min/Max',
    subtitle: 'Preserves peaks per screen pixel',
    tag: 'OPTIMIZED',
    footer: 'Downsampled to plot resolution',
  },
}

function App() {
  const [data] = useState(generateSeries)
  const {
    viewport,
    setViewport,
    resetViewport,
    onWheel,
    handlers,
  } = useViewport(data.extent)
  const [benchmarkResults, setBenchmarkResults] = useState<
    Partial<Record<Renderer, BenchmarkResult>>
  >({})
  const [benchmarkRenderer, setBenchmarkRenderer] = useState<Renderer | null>(
    null,
  )
  const [isBenchmarking, setIsBenchmarking] = useState(false)
  const visibleRange = getVisibleRange(data.values.length, viewport)
  const visiblePoints = visibleRange.end - visibleRange.start

  const handleBenchmark = async () => {
    const initialViewport = { ...viewport }
    const results: Partial<Record<Renderer, BenchmarkResult>> = {}
    setIsBenchmarking(true)
    setBenchmarkResults({})

    try {
      for (const renderer of RENDERERS) {
        setBenchmarkRenderer(renderer)
        setViewport(initialViewport)
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0))

        results[renderer] = await runBenchmark({
          initialViewport,
          extent: data.extent,
          durationMs: BENCHMARK_DURATION_MS,
          onViewportChange: setViewport,
        })
        setBenchmarkResults({ ...results })
      }
    } finally {
      setViewport(initialViewport)
      setBenchmarkRenderer(null)
      setIsBenchmarking(false)
    }
  }

  const visibleRenderers: readonly Renderer[] = benchmarkRenderer
    ? [benchmarkRenderer]
    : RENDERERS

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <div className="eyebrow">
            <span className="status-dot" />
            RENDERING LAB
          </div>
          <h1>One signal. Three ways to see it.</h1>
          <p className="intro">
            Explore a 100,000-point market series and compare how SVG and canvas
            handle the same data.
          </p>
        </div>
        <div className="header-badge">
          <span className="badge-value">{data.values.length.toLocaleString()}</span>
          <span className="badge-label">data points</span>
        </div>
      </header>

      <section className="control-panel" aria-label="Chart controls">
        <div className="range-readout">
          <span className="control-label">VISIBLE WINDOW</span>
          <strong>
            {Math.round(viewport.xMin).toLocaleString()}
            <span className="range-divider">—</span>
            {Math.round(viewport.xMax).toLocaleString()}
          </strong>
          <span className="muted">
            {visiblePoints.toLocaleString()} points in view
          </span>
        </div>
        <p className="interaction-hint">
          Scroll to zoom <span>·</span> drag to pan
        </p>
        <div className="control-actions">
          <button
            className="button button-quiet"
            type="button"
            onClick={resetViewport}
            disabled={isBenchmarking}
          >
            Reset view
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={() => void handleBenchmark()}
            disabled={isBenchmarking}
          >
            {isBenchmarking ? (
              <>
                <span className="spinner" />
                Measuring {RENDERER_INFO[benchmarkRenderer ?? 'svg'].title}…
              </>
            ) : (
              <>
                <span aria-hidden="true">▶</span>
                Run benchmark
              </>
            )}
          </button>
        </div>
      </section>

      <section
        className={`chart-grid${benchmarkRenderer ? ' chart-grid-benchmark' : ''}`}
        aria-label="Renderer comparison"
      >
        {visibleRenderers.map((renderer) => (
          <ChartPanel
            key={renderer}
            renderer={renderer}
            data={data}
            viewport={viewport}
            handlers={handlers}
            onWheel={onWheel}
          />
        ))}
      </section>

      <section className="benchmark-panel" aria-live="polite">
        <div className="benchmark-copy">
          <div className="eyebrow">FRAME PERFORMANCE</div>
          <h2>
            {isBenchmarking
              ? `Measuring ${RENDERER_INFO[benchmarkRenderer ?? 'svg'].title}`
              : Object.keys(benchmarkResults).length > 0
                ? 'Benchmark complete'
                : 'Put the renderers to work'}
          </h2>
          <p>
            {Object.keys(benchmarkResults).length > 0 || isBenchmarking
              ? 'Each renderer runs an identical scripted zoom and pan on its own.'
              : 'Run a scripted zoom-and-pan test to compare frame pacing for each renderer.'}
          </p>
        </div>
        {Object.keys(benchmarkResults).length > 0 || isBenchmarking ? (
          <div className="benchmark-metrics">
            {RENDERERS.map((renderer) => {
              const result = benchmarkResults[renderer]
              return (
                <div className="benchmark-result" key={renderer}>
                  <span>{RENDERER_INFO[renderer].title}</span>
                  <strong>
                    {result ? `${result.fps.toFixed(1)} FPS` : '—'}
                  </strong>
                  <small>
                    {result
                      ? `mean ${result.meanFrameTimeMs.toFixed(1)} ms · p95 ${result.p95FrameTimeMs.toFixed(1)} ms`
                      : benchmarkRenderer === renderer
                        ? 'Measuring…'
                        : 'Pending'}
                  </small>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="benchmark-placeholder">
            <span className="placeholder-mark">↗</span>
            <span>Results appear here</span>
          </div>
        )}
      </section>

      <footer className="app-footer">
        <span>GENERATED SERIES · SEEDED FOR REPEATABLE COMPARISONS</span>
        <span>WHEEL TO ZOOM&nbsp;&nbsp; / &nbsp;&nbsp;DRAG TO PAN</span>
      </footer>
    </main>
  )
}

function ChartPanel({
  renderer,
  data,
  viewport,
  handlers,
  onWheel,
}: {
  renderer: Renderer
  data: ChartProps['data']
  viewport: ChartProps['viewport']
  handlers: ViewportHandlers
  onWheel: (event: globalThis.WheelEvent, element: HTMLElement) => void
}) {
  const info = RENDERER_INFO[renderer]

  return (
    <article
      className={`chart-card${renderer === 'minmax' ? ' chart-card-featured' : ''}`}
    >
      <div className="chart-card-header">
        <div className="renderer-title">
          <span className="renderer-index">{info.index}</span>
          <div>
            <h2>{info.title}</h2>
            <p>{info.subtitle}</p>
          </div>
        </div>
        <span
          className={`renderer-tag${renderer === 'minmax' ? ' tag-optimized' : ''}`}
        >
          {info.tag}
        </span>
      </div>
      <ChartSurface handlers={handlers} onWheel={onWheel}>
        {renderer === 'svg' ? (
          <SvgChart data={data} viewport={viewport} />
        ) : renderer === 'canvas' ? (
          <CanvasChart data={data} viewport={viewport} />
        ) : (
          <CanvasMinMaxChart data={data} viewport={viewport} />
        )}
      </ChartSurface>
      <div className="chart-card-footer">
        <span>{info.footer}</span>
        <span className="legend">
          <i className={`legend-dot ${renderer === 'svg' ? 'svg-dot' : 'canvas-dot'}`} />
          Price
        </span>
      </div>
    </article>
  )
}

function ChartSurface({
  children,
  handlers,
  onWheel,
}: {
  children: ReactNode
  handlers: ViewportHandlers
  onWheel: (event: globalThis.WheelEvent, element: HTMLElement) => void
}) {
  const surfaceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return

    const handleWheel = (event: globalThis.WheelEvent) => onWheel(event, surface)
    surface.addEventListener('wheel', handleWheel, { passive: false })
    return () => surface.removeEventListener('wheel', handleWheel)
  }, [onWheel])

  return (
    <div ref={surfaceRef} className="chart-surface" {...handlers}>
      {children}
    </div>
  )
}

export default App
