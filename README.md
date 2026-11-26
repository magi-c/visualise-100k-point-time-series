React 19 + TypeScript app that draws the same 100,000-point price series in three ways — **SVG**, **full-resolution canvas** and **min/max-decimated canvas** — with shared pan and zoom, and measures each renderer with a scripted benchmark. No charting library: scales, ticks, decimation and the benchmark are hand-written.

<img width="1367" height="918" alt="Three renderers side by side with the benchmark results table" src="https://github.com/user-attachments/assets/c3a9e226-4873-4d90-819e-fcbe2b3b9a70" />

## Results

Each renderer runs alone at 1000 px wide, after 10 warm-up frames, for 4 s per phase:

- **All 100k visible**: the view wobbles between 98% and 100% of the data, so every point is drawn every frame (worst case).
- **Zoom & pan**: scripted zoom between 16% and 92% of the data, with panning.

| Renderer | Phase | FPS | p95 frame (ms) | Max frame (ms) | Frames over budget | Long tasks | Heap (MB) |
|---|---|--:|--:|--:|--:|--:|--:|
| SVG | All 100k visible | 5.4 | 220.0 | 220.1 | 22 / 22 | 22 | 43.2 |
| SVG | Zoom & pan | 10.8 | 200.0 | 240.2 | 43 / 43 | 14 | 28.4 |
| Canvas (full) | All 100k visible | 10.1 | 140.3 | 159.9 | 41 / 41 | 0 | 32.0 |
| Canvas (full) | Zoom & pan | 22.6 | 100.0 | 120.1 | 91 / 91 | 0 | 35.6 |
| Canvas min/max | All 100k visible | 49.0 | 20.1 | 60.0 | 195 / 195 | 0 | 13.1 |
| Canvas min/max | Zoom & pan | 50.0 | 20.2 | 20.3 | 199 / 199 | 0 | 20.5 |

Budget: 16.7 ms per frame (60 Hz) + 1 ms tolerance for vsync jitter.
Measured on: TODO machine (CPU, RAM) · TODO browser and version · TODO Hz display · devicePixelRatio TODO.

To reproduce: `npm run dev` in `100k-point/`, click **Run benchmark**. The same table is printed to the console with `console.table`. The app also reports long tasks (> 50 ms) and JS heap, Chromium only.

### What the benchmark does to stay honest

- Every frame applies the new viewport with `flushSync`, so React renders inside the frame being measured instead of batching it after paint.
- Everything except the chart under test is memoised with stable props, so shared UI work isn't added to every renderer and doesn't hide the differences between them.
- The chart under test is the only one mounted, and user input is locked during a run.
- Results report p95, max and frames over budget, not just average FPS, because an average hides stutter.

## Why min/max beats full canvas

The plot is about 920 px wide. With all 100k points visible, full-resolution canvas issues ~100,000 `lineTo` calls per frame, so roughly 108 points land in every pixel column and the rasteriser draws the same pixels over and over. A pixel column can only show the vertical range of the points inside it. Min/max decimation therefore scans the visible points once (cheap arithmetic over a `Float64Array`, into reused buffers with no allocations per frame) and keeps just the lowest and highest point in each column. That's at most ~1,840 vertices instead of 100,000, and the picture is identical. SVG pays a further cost: it builds a 100k-segment path string every frame and passes it through the DOM, styling and geometry pipeline.

## Spike preservation

The generated series includes rare single-sample spikes (±9 on a ~100 baseline, about 0.04% of points, ~40 in total). Naive decimation, such as drawing every Nth point, would keep a given spike with a probability of about 1/N (~1/108 at full extent), so almost all of them would disappear and the chart would show data that looks calmer than it is. Min/max keeps every spike, because a spike is the extreme value of its pixel column by definition. Each column's min and max are also drawn in index order, not always min then max, so the line's shape around a peak stays correct.

## Other details

- Y-axis ticks use 1/2/5 × 10ⁿ steps, labelled with exactly the precision the step needs. Tick values are computed as `i * step`, so floating-point error doesn't accumulate.
- Canvas draws in `useLayoutEffect`, before the browser paints, so no frame shows a stale chart. The backing store is resized only when its size changes, and drawing is scaled for `devicePixelRatio`.
- The visible index range is found by binary search, plus one neighbour on each side so the line reaches the plot edges.
- The data is seeded (deterministic), so runs are comparable.

## Run locally

```sh
cd 100k-point
npm install
npm run dev     # wheel to zoom, drag to pan
npm run build
npm run lint
```

