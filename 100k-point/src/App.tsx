import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { runBenchmark, waitFrames } from './bench/runBenchmark'
import { generateSeries } from './data/generate'
import { useViewport } from './hooks/useViewport'
import { getVisibleRange } from './lib/scale'
import type {
  BenchmarkPhase,
  BenchmarkResult,
  ChartProps,
  Viewport,
} from './lib/types'
import { CanvasChart } from './renderers/CanvasChart'
import { CanvasMinMaxChart } from './renderers/CanvasMinMaxChart'
import { SvgChart } from './renderers/SvgChart'
import './App.css'

// ~240 frames per phase at 60 Hz: enough for a stable p95.
const BENCHMARK_DURATION_MS = 4_000
// Frames to wait after mounting a chart / resetting the view, so setup work
// isn't counted in the measurement.
const WARMUP_FRAMES = 10
const RENDERERS = ['svg', 'canvas', 'minmax'] as const
type Renderer = (typeof RENDERERS)[number]
const BENCHMARK_PHASES: readonly BenchmarkPhase[] = ['full-extent', 'zoom-pan']
const PHASE_LABEL: Record<BenchmarkPhase, string> = {
  'full-extent': 'All 100k visible',
  'zoom-pan': 'Zoom & pan',
}
type BenchmarkResults = Partial<
  Record<Renderer, Partial<Record<BenchmarkPhase, BenchmarkResult>>>
>
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

/*
 * Render cost during a benchmark frame
 * -----------------------------------
 * Every frame of a run calls flushSync(setViewport), which re-renders App.
 * Only the chart under test should do real work in that render, otherwise
 * the same overhead is added to every renderer and hides the differences.
 * So everything else is a memo'd component whose props stay referentially
 * stable during a run:
 *   - AppHeader, AppFooter: static
 *   - ControlPanel: shows a frozen viewport while measuring
 *   - BenchmarkPanel: changes only when a phase finishes
 *   - ChartCardHeader / ChartCardFooter: the card chrome around the chart
 * Callbacks passed to them are stable (useCallback + a ref for the latest
 * values). Check with React DevTools > Profiler > "Highlight updates".
 */
function App() {
  const [data] = useState(generateSeries)
  const {
    viewport,
    setViewport,
    resetViewport,
    onWheel,
    handlers,
  } = useViewport(data.extent)
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResults>(
    {},
  )
  const [benchmarkRenderer, setBenchmarkRenderer] = useState<Renderer | null>(
    null,
  )
  const [isBenchmarking, setIsBenchmarking] = useState(false)
  // Renderers included in the current run (all three, or a single chart).
  const [benchmarkQueue, setBenchmarkQueue] = useState<readonly Renderer[]>([])
  // The readout shows this (the view restored afterwards) while measuring,
  // so it doesn't re-render on every benchmark frame.
  const [frozenViewport, setFrozenViewport] = useState<Viewport | null>(null)

  // Latest values read by the benchmark, so handleBenchmark can stay stable.
  const latest = useRef({ viewport, benchmarkResults })
  useLayoutEffect(() => {
    latest.current = { viewport, benchmarkResults }
  })

  const handleBenchmark = useCallback(
    async (renderers: readonly Renderer[]) => {
      // Restored afterwards; the benchmark itself always starts from full extent.
      const initialViewport = { ...latest.current.viewport }
      const fullViewport: Viewport = {
        xMin: data.extent.xMin,
        xMax: data.extent.xMax,
      }
      // flushSync: render inside the current frame. Without it React 19 may
      // batch the update and render after paint, so the frame time is wrong.
      const applyViewport = (next: Viewport) =>
        flushSync(() => setViewport(next))
      // Keep earlier results for charts that aren't re-measured in this run.
      const results: BenchmarkResults = { ...latest.current.benchmarkResults }
      for (const renderer of renderers) delete results[renderer]
      setFrozenViewport(initialViewport)
      setIsBenchmarking(true)
      setBenchmarkQueue(renderers)
      setBenchmarkResults({ ...results })

      try {
        for (const renderer of renderers) {
          flushSync(() => setBenchmarkRenderer(renderer))

          for (const phase of BENCHMARK_PHASES) {
            applyViewport(fullViewport)
            await waitFrames(WARMUP_FRAMES)

            const result = await runBenchmark({
              phase,
              extent: data.extent,
              durationMs: BENCHMARK_DURATION_MS,
              onViewportChange: applyViewport,
            })
            results[renderer] = { ...results[renderer], [phase]: result }
            setBenchmarkResults({ ...results })
          }
        }
        console.table(
          renderers.flatMap((renderer) =>
            BENCHMARK_PHASES.map((phase) => ({
              renderer,
              phase,
              ...results[renderer]?.[phase],
            })),
          ),
        )
      } finally {
        setViewport(initialViewport)
        setFrozenViewport(null)
        setBenchmarkRenderer(null)
        setBenchmarkQueue([])
        setIsBenchmarking(false)
      }
    },
    [data.extent, setViewport],
  )

  const handleRunAll = useCallback(() => {
    void handleBenchmark(RENDERERS)
  }, [handleBenchmark])

  const handleMeasure = useCallback(
    (renderer: Renderer) => {
      void handleBenchmark([renderer])
    },
    [handleBenchmark],
  )

  const visibleRenderers: readonly Renderer[] = benchmarkRenderer
    ? [benchmarkRenderer]
    : RENDERERS

  return (
    <main className="app-shell">
      <AppHeader pointCount={data.values.length} />

      <ControlPanel
        viewport={frozenViewport ?? viewport}
        pointCount={data.values.length}
        isBenchmarking={isBenchmarking}
        benchmarkRenderer={benchmarkRenderer}
        onReset={resetViewport}
        onRunAll={handleRunAll}
      />

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
            onMeasure={handleMeasure}
            isBenchmarking={isBenchmarking}
          />
        ))}
      </section>

      <BenchmarkPanel
        results={benchmarkResults}
        isBenchmarking={isBenchmarking}
        benchmarkRenderer={benchmarkRenderer}
        benchmarkQueue={benchmarkQueue}
      />

      <AppFooter />
    </main>
  )
}

const AppHeader = memo(function AppHeader({
  pointCount,
}: {
  pointCount: number
}) {
  return (
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
        <span className="badge-value">{pointCount.toLocaleString()}</span>
        <span className="badge-label">data points</span>
      </div>
    </header>
  )
})

const ControlPanel = memo(function ControlPanel({
  viewport,
  pointCount,
  isBenchmarking,
  benchmarkRenderer,
  onReset,
  onRunAll,
}: {
  viewport: Viewport
  pointCount: number
  isBenchmarking: boolean
  benchmarkRenderer: Renderer | null
  onReset: () => void
  onRunAll: () => void
}) {
  const visibleRange = getVisibleRange(pointCount, viewport)
  const visiblePoints = visibleRange.end - visibleRange.start

  return (
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
          onClick={onReset}
          disabled={isBenchmarking}
        >
          Reset view
        </button>
        <button
          className="button button-primary"
          type="button"
          onClick={onRunAll}
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
  )
})

const BenchmarkPanel = memo(function BenchmarkPanel({
  results,
  isBenchmarking,
  benchmarkRenderer,
  benchmarkQueue,
}: {
  results: BenchmarkResults
  isBenchmarking: boolean
  benchmarkRenderer: Renderer | null
  benchmarkQueue: readonly Renderer[]
}) {
  const hasResults = Object.keys(results).length > 0
  const showTable = hasResults || isBenchmarking

  return (
    <section
      className={`benchmark-panel${showTable ? ' benchmark-panel-results' : ''}`}
      aria-live="polite"
    >
      <div className="benchmark-copy">
        <div className="eyebrow">FRAME PERFORMANCE</div>
        <h2>
          {isBenchmarking
            ? `Measuring ${RENDERER_INFO[benchmarkRenderer ?? 'svg'].title}`
            : hasResults
              ? 'Benchmark complete'
              : 'Put the renderers to work'}
        </h2>
        <p>
          {showTable
            ? 'Each renderer runs alone at 1000 px, from the full data extent: first with all 100,000 points visible, then a scripted zoom and pan.'
            : 'Run a scripted zoom-and-pan test to compare frame pacing for each renderer.'}
        </p>
      </div>
      {showTable ? (
        <div className="benchmark-table-wrap">
          <table className="benchmark-table">
            <thead>
              <tr>
                <th scope="col">Renderer</th>
                <th scope="col">
                  <HeaderTip label="Phase" tip={COLUMN_TIPS.phase} align="left" />
                </th>
                <th scope="col" className="num">
                  <HeaderTip label="FPS" tip={COLUMN_TIPS.fps} />
                </th>
                <th scope="col" className="num">
                  <HeaderTip label="p95 ms" tip={COLUMN_TIPS.p95} />
                </th>
                <th scope="col" className="num">
                  <HeaderTip label="Max ms" tip={COLUMN_TIPS.max} />
                </th>
                <th scope="col" className="num">
                  <HeaderTip label="Over budget" tip={COLUMN_TIPS.overBudget} />
                </th>
                <th scope="col" className="num">
                  <HeaderTip label="Long tasks" tip={COLUMN_TIPS.longTasks} />
                </th>
                <th scope="col" className="num">
                  <HeaderTip label="Heap MB" tip={COLUMN_TIPS.heap} />
                </th>
              </tr>
            </thead>
            <tbody>
              {RENDERERS.flatMap((renderer) =>
                BENCHMARK_PHASES.map((phase, phaseIndex) => {
                  const result = results[renderer]?.[phase]
                  return (
                    <tr
                      key={`${renderer}-${phase}`}
                      className={phaseIndex === 0 ? 'group-start' : undefined}
                    >
                      {phaseIndex === 0 && (
                        <th scope="row" rowSpan={BENCHMARK_PHASES.length}>
                          {RENDERER_INFO[renderer].title}
                        </th>
                      )}
                      <td>{PHASE_LABEL[phase]}</td>
                      {result ? (
                        <>
                          <td className="num">{result.fps.toFixed(1)}</td>
                          <td className="num">{result.p95FrameTimeMs.toFixed(1)}</td>
                          <td className="num">{result.maxFrameTimeMs.toFixed(1)}</td>
                          <td className="num">
                            {result.framesOverBudget} / {result.frameCount}
                          </td>
                          <td className="num">{result.longTasks}</td>
                          <td className="num">
                            {result.heapMB === null ? '—' : result.heapMB.toFixed(1)}
                          </td>
                        </>
                      ) : (
                        <td className="status" colSpan={6}>
                          {benchmarkRenderer === renderer
                            ? 'Measuring…'
                            : benchmarkQueue.includes(renderer)
                              ? 'Pending'
                              : 'Not run'}
                        </td>
                      )}
                    </tr>
                  )
                }),
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="benchmark-placeholder">
          <span className="placeholder-mark">↗</span>
          <span>Results appear here</span>
        </div>
      )}
    </section>
  )
})

const AppFooter = memo(function AppFooter() {
  return (
    <footer className="app-footer">
      <span>GENERATED SERIES · SEEDED FOR REPEATABLE COMPARISONS</span>
      <span>WHEEL TO ZOOM&nbsp;&nbsp; / &nbsp;&nbsp;DRAG TO PAN</span>
    </footer>
  )
})

const COLUMN_TIPS = {
  phase:
    'All 100k visible: the view stays at 98–100% of the data, so every point is drawn (worst case). Zoom & pan: a scripted zoom between 16% and 92% of the data with panning, starting from the full extent.',
  fps:
    'Average frames per second over the phase (1000 ÷ mean frame time). Higher is better; 60 is the ceiling on a 60 Hz screen. An average hides stutter, so read it together with p95 and Max.',
  p95:
    '95th-percentile frame time: 95% of frames were this fast or faster. Under 16.7 ms means the chart stays smooth at 60 Hz.',
  max:
    'The single slowest frame in the phase: the worst hitch a user would notice.',
  overBudget:
    'Frames that took longer than the 60 Hz budget (16.7 ms, plus 1 ms tolerance for vsync jitter), out of all recorded frames. Each one is a dropped frame.',
  longTasks:
    'Main-thread tasks longer than 50 ms during the phase. While one runs, the page cannot respond to input. Chromium only; always 0 in Firefox and Safari.',
  heap:
    'JavaScript heap in use at the end of the phase. Chromium only and coarse; shown as — elsewhere. Does not include canvas pixel memory or the SVG render tree.',
} as const

/** Column header with a tooltip shown on hover and on keyboard focus. */
function HeaderTip({
  label,
  tip,
  align = 'right',
}: {
  label: string
  tip: string
  align?: 'left' | 'right'
}) {
  const tipId = useId()

  return (
    <span className="th-tip" tabIndex={0} aria-describedby={tipId}>
      {label}
      <span
        id={tipId}
        role="tooltip"
        className={`th-tip-bubble th-tip-${align}`}
      >
        {tip}
      </span>
    </span>
  )
}

/** Re-renders every frame (it gets the viewport); keep it thin. */
function ChartPanel({
  renderer,
  data,
  viewport,
  handlers,
  onWheel,
  onMeasure,
  isBenchmarking,
}: {
  renderer: Renderer
  data: ChartProps['data']
  viewport: ChartProps['viewport']
  handlers: ViewportHandlers
  onWheel: (event: globalThis.WheelEvent, element: HTMLElement) => void
  onMeasure: (renderer: Renderer) => void
  isBenchmarking: boolean
}) {
  return (
    <article
      className={`chart-card${renderer === 'minmax' ? ' chart-card-featured' : ''}`}
    >
      <ChartCardHeader
        renderer={renderer}
        onMeasure={onMeasure}
        measureDisabled={isBenchmarking}
      />
      <ChartSurface
        handlers={handlers}
        onWheel={onWheel}
        interactive={!isBenchmarking}
      >
        {renderer === 'svg' ? (
          <SvgChart data={data} viewport={viewport} />
        ) : renderer === 'canvas' ? (
          <CanvasChart data={data} viewport={viewport} />
        ) : (
          <CanvasMinMaxChart data={data} viewport={viewport} />
        )}
      </ChartSurface>
      <ChartCardFooter renderer={renderer} />
    </article>
  )
}

const ChartCardHeader = memo(function ChartCardHeader({
  renderer,
  onMeasure,
  measureDisabled,
}: {
  renderer: Renderer
  onMeasure: (renderer: Renderer) => void
  measureDisabled: boolean
}) {
  const info = RENDERER_INFO[renderer]

  return (
    <div className="chart-card-header">
      <div className="renderer-title">
        <span className="renderer-index">{info.index}</span>
        <div>
          <h2>{info.title}</h2>
          <p>{info.subtitle}</p>
        </div>
      </div>
      <div className="chart-card-actions">
        <span
          className={`renderer-tag${renderer === 'minmax' ? ' tag-optimized' : ''}`}
        >
          {info.tag}
        </span>
        <button
          className="button button-quiet button-small"
          type="button"
          onClick={() => onMeasure(renderer)}
          disabled={measureDisabled}
          aria-label={`Measure ${info.title} only`}
        >
          Measure
        </button>
      </div>
    </div>
  )
})

const ChartCardFooter = memo(function ChartCardFooter({
  renderer,
}: {
  renderer: Renderer
}) {
  return (
    <div className="chart-card-footer">
      <span>{RENDERER_INFO[renderer].footer}</span>
      <span className="legend">
        <i className={`legend-dot ${renderer === 'svg' ? 'svg-dot' : 'canvas-dot'}`} />
        Price
      </span>
    </div>
  )
})

function ChartSurface({
  children,
  handlers,
  onWheel,
  interactive,
}: {
  children: ReactNode
  handlers: ViewportHandlers
  onWheel: (event: globalThis.WheelEvent, element: HTMLElement) => void
  /** false while a benchmark runs: user input would add extra renders. */
  interactive: boolean
}) {
  const surfaceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return

    const handleWheel = (event: globalThis.WheelEvent) => {
      if (!interactive) {
        event.preventDefault() // don't scroll the page away mid-run either
        return
      }
      onWheel(event, surface)
    }
    surface.addEventListener('wheel', handleWheel, { passive: false })
    return () => surface.removeEventListener('wheel', handleWheel)
  }, [onWheel, interactive])

  return (
    <div
      ref={surfaceRef}
      className={`chart-surface${interactive ? '' : ' chart-surface-locked'}`}
      {...(interactive ? handlers : {})}
    >
      {children}
    </div>
  )
}

export default App
