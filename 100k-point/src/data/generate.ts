import type { DataExtent, SeriesData } from '../lib/types'

export function getExtent(values: Float64Array): DataExtent {
  if (values.length === 0) {
    throw new RangeError('Cannot calculate the extent of an empty series.')
  }

  let yMin = Infinity
  let yMax = -Infinity

  for (const value of values) {
    yMin = Math.min(yMin, value)
    yMax = Math.max(yMax, value)
  }

  return {
    xMin: 0,
    xMax: values.length - 1,
    yMin,
    yMax,
  }
}

export function generateSeries(count = 100_000): SeriesData {
  if (!Number.isInteger(count) || count < 2) {
    throw new RangeError('The series must contain at least two points.')
  }

  const values = new Float64Array(count)
  let seed = 42

  for (let index = 0; index < count; index += 1) {
    seed = (seed * 16_807) % 2_147_483_647
    const noise = (seed / 2_147_483_647 - 0.5) * 1.8
    const trend = index * 0.000035
    const cycles =
      Math.sin(index * 0.00042) * 12 +
      Math.sin(index * 0.0031) * 4.5 +
      Math.cos(index * 0.00009) * 8

    // Rare single-sample spikes (~0.04% of points). Min/max downsampling must
    // still show every one of them; naive decimation would drop most.
    seed = (seed * 16_807) % 2_147_483_647
    const spikeRoll = seed / 2_147_483_647
    const spike = spikeRoll < 0.0004 ? (spikeRoll < 0.0002 ? 9 : -9) : 0

    values[index] = 100 + trend + cycles + noise + spike
  }

  return { values, extent: getExtent(values) }
}
