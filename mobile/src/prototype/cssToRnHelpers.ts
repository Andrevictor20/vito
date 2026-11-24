export type TokenMap = Record<string, string>;

const DEFAULT_BASE_FONT = 16

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Resolve `var(--name)` e `var(--name, fallback)` recursivamente. */
export function resolveVars(raw: string, tokens: TokenMap, depth = 0): string {
  if (depth > 8 || !raw.includes('var(')) return raw.trim()
  let out = ''
  let i = 0
  while (i < raw.length) {
    const idx = raw.indexOf('var(', i)
    if (idx === -1) {
      out += raw.slice(i)
      break
    }
    out += raw.slice(i, idx)
    let paren = 1
    let j = idx + 4
    while (j < raw.length && paren > 0) {
      if (raw[j] === '(') paren += 1
      else if (raw[j] === ')') paren -= 1
      j += 1
    }
    const inner = raw.slice(idx + 4, j - 1)
    const comma = splitTopLevelComma(inner)
    const varName = comma[0].trim()
    const fallback = comma.length > 1 ? comma.slice(1).join(',').trim() : ''
    const resolved = tokens[varName] ?? fallback
    out += resolved ? resolveVars(resolved, tokens, depth + 1) : ''
    i = j
  }
  return out.trim()
}

export function splitTopLevelComma(str: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < str.length; i += 1) {
    const ch = str[i]
    if (ch === '(') depth += 1
    else if (ch === ')') depth -= 1
    else if (ch === ',' && depth === 0) {
      parts.push(str.slice(start, i))
      start = i + 1
    }
  }
  parts.push(str.slice(start))
  return parts
}

export function splitTopLevelSpace(str: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < str.length; i += 1) {
    const ch = str[i]
    if (ch === '(') depth += 1
    else if (ch === ')') depth -= 1
    if (/\s/.test(ch) && depth === 0) {
      if (cur) {
        parts.push(cur)
        cur = ''
      }
    } else {
      cur += ch
    }
  }
  if (cur) parts.push(cur)
  return parts
}

export function hexOrRgbToRgba(color: string): [number, number, number, number] | null {
  const c = color.trim().toLowerCase()
  if (c === 'transparent') return [0, 0, 0, 0]
  if (c === '#000' || c === 'black') return [0, 0, 0, 1]
  if (c === '#fff' || c === 'white') return [255, 255, 255, 1]
  if (c.startsWith('#')) {
    const hex = c.slice(1)
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
        1,
      ]
    }
    if (hex.length === 6 || hex.length === 8) {
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        round2(a),
      ]
    }
  }
  const m = c.match(/^rgba?\(([^)]+)\)$/)
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean)
    if (parts.length >= 3) {
      const r = Number(parts[0])
      const g = Number(parts[1])
      const b = Number(parts[2])
      let a = parts[3] !== undefined ? Number(parts[3].replace('%', '')) : 1
      if (parts[3]?.endsWith('%')) a /= 100
      return [r, g, b, clamp01(a)]
    }
  }
  return null
}

export function rgbaToString([r, g, b, a]: [number, number, number, number]): string {
  const rr = Math.round(r)
  const gg = Math.round(g)
  const bb = Math.round(b)
  if (a >= 0.999) {
    const toHex = (n: number) => n.toString(16).padStart(2, '0')
    return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`
  }
  return `rgba(${rr}, ${gg}, ${bb}, ${round2(a)})`
}