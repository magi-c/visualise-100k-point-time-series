# 100k-point rendering lab

A React and TypeScript demo that renders a deterministic 100,000-point time
series with SVG, full-resolution Canvas, and min/max-downsampled Canvas.

## Run locally

```sh
npm install
npm run dev
```

Use the mouse wheel over a chart to zoom and drag to pan. All three renderers
share the same viewport. **Run benchmark** measures scripted zooming and panning
for each renderer individually and reports average FPS and frame-time statistics.

```sh
npm run build
npm run lint
```
