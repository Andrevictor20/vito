/**
 * chartSpecs.ts — Constantes e cálculos puros copiados 1:1 do JS/CSS do protótipo
 * (donut, area, bars, gbars, tk-ring, fx-ring, rs-rg, rs-ln).
 */

export const DONUT_R = 44
export const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_R
export const DONUT_GAP = 2
export const DONUT_SIZE = 176
export const DONUT_STROKE = 14
export const DONUT_SEG_MS = 720
export const DONUT_STAGGER_BASE_MS = 35
export const DONUT_STAGGER_STEP_MS = 60
export const DONUT_TEXT_MS = 450
export const DONUT_TEXT_DELAY_MS = 180

export const BAR_RISE_MS = 560
export const AREA_DRAW_MS = 780
export const AREA_DRAW_DELAY_MS = 60
export const AREA_FILL_MS = 500
export const AREA_FILL_DELAY_MS = 220
export const DOT_POP_MS = 360
export const DOT_POP_DELAY_MS = 540

export const TK_RING_SIZE = 56
export const TK_RING_R = 22
export const TK_RING_CIRCUMFERENCE = 2 * Math.PI * TK_RING_R
export const FX_RING_SIZE = 64
export const SUMMARY_LINE_FADE_MS = 1000
export const SUMMARY_LINE_DELAY_MS = 600

export interface DonutSliceInput {
  label: string
  value: number
  color?: string
}

export interface DonutSegment {
  label: string
  value: number
  colorIndex: number
  color?: string
  dashArray: [number, number]
  dashOffset: number
}

export function computeDonutSegments(data: readonly DonutSliceInput[]): DonutSegment[] {
  const total = data.reduce((acc, s) => acc + Math.max(0, s.value), 0)
  if (total <= 0) return []
  let off = 0
  return data.map((s, idx) => {
    const val = Math.max(0, s.value)
    const l = (val / total) * DONUT_CIRCUMFERENCE
    const segLen = Math.max(l - DONUT_GAP, 0)
    const rest = Math.max(DONUT_CIRCUMFERENCE - l + DONUT_GAP, 0)
    const seg: DonutSegment = {
      label: s.label,
      value: val,
      colorIndex: idx % 5,
      color: s.color,
      dashArray: [Number(segLen.toFixed(1)), Number(rest.toFixed(1))],
      dashOffset: Number((-off).toFixed(1)),
    }
    off += l
    return seg
  })
}

export interface AreaGeometry {
  linePath: string
  fillPath: string
  points: Array<{ x: number; y: number }>
  lastPoint: { x: number; y: number } | null
  approxLength: number
}

export function computeAreaPath(
  values: readonly number[],
  width = 320,
  height = 120,
): AreaGeometry {
  if (values.length === 0) {
    return { linePath: '', fillPath: '', points: [], lastPoint: null, approxLength: 0 }
  }
  const maxVal = Math.max(...values) * 1.2 || 1
  const n = Math.max(1, values.length - 1)
  const xAt = (i: number) => (values.length === 1 ? width / 2 : 8 + (i / n) * (width - 16))
  const yAt = (v: number) => height - (v / maxVal) * height

  const points = values.map((v, i) => ({
    x: Number(xAt(i).toFixed(1)),
    y: Number(yAt(v).toFixed(1)),
  }))

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`)
    .join('')
  const first = points[0]
  const last = points[points.length - 1]
  const fillPath = `${linePath}L${last.x} ${height}L${first.x} ${height}Z`

  let approxLength = 0
  for (let i = 1; i < points.length; i += 1) {
    approxLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }

  return {
    linePath,
    fillPath,
    points,
    lastPoint: last,
    approxLength: Math.max(1, Math.ceil(approxLength)),
  }
}

export interface BarRect {
  x: number
  y: number
  width: number
  height: number
  delayMs: number
  highlighted: boolean
}

export function computeBarRects(
  values: readonly number[],
  width = 320,
  height = 110,
  highlightIndex?: number,
): { rects: BarRect[]; max: number } {
  if (values.length === 0) return { rects: [], max: 1 }
  const max = Math.max(...values) * 1.1 || 1
  const n = values.length
  const bw = width / n
  const step = n > 10 ? 16 : 50
  const rects: BarRect[] = values.map((v, i) => {
    const h = (Math.max(0, v) / max) * height
    return {
      x: Number((i * bw + bw * 0.18).toFixed(1)),
      y: Number((height - h).toFixed(1)),
      width: Number((bw * 0.64).toFixed(1)),
      height: Number(h.toFixed(1)),
      delayMs: i * step,
      highlighted: highlightIndex === i,
    }
  })
  return { rects, max }
}
