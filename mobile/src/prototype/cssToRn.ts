/**
 * cssToRn.ts — Tradutor determinístico CSS → React Native StyleSheet.
 * Único ponto de conversão de propriedades extraídas de Vito-telas-atualizadas.html.
 */

export type TokenMap = Record<string, string>

export interface ShadowStyle {
  shadowColor: string
  shadowOffset: { width: number; height: number }
  shadowOpacity: number
  shadowRadius: number
  elevation: number
}

export interface InsetBorderStyle {
  borderLeftWidth?: number
  borderLeftColor?: string
  borderTopWidth?: number
  borderTopColor?: string
  borderRightWidth?: number
  borderRightColor?: string
  borderBottomWidth?: number
  borderBottomColor?: string
}

export interface RnStyleResult {
  style: Record<string, unknown>
  insetBorder?: InsetBorderStyle
  unsupported: string[]
}

const DEFAULT_BASE_FONT = 16

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function round2(n: number): number {
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

function splitTopLevelComma(str: string): string[] {
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

function splitTopLevelSpace(str: string): string[] {
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

function rgbaToString([r, g, b, a]: [number, number, number, number]): string {
  const rr = Math.round(r)
  const gg = Math.round(g)
  const bb = Math.round(b)
  if (a >= 0.999) {
    const toHex = (n: number) => n.toString(16).padStart(2, '0')
    return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`
  }
  return `rgba(${rr}, ${gg}, ${bb}, ${round2(a)})`
}

/** Resolve `color-mix(in srgb, <c1> <pct>%, <c2>)`. */
export function parseColor(raw: string, tokens: TokenMap = {}): string {
  const v = resolveVars(raw, tokens)
  const cm = v.match(/^color-mix\(\s*in\s+srgb\s*,\s*(.+)\)$/i)
  if (cm) {
    const args = splitTopLevelComma(cm[1])
    if (args.length === 2) {
      const parsePart = (p: string): { col: [number, number, number, number]; pct: number | null } => {
        const tokensPart = splitTopLevelSpace(p.trim())
        const pctToken = tokensPart.find((t) => t.endsWith('%'))
        const colToken = tokensPart.filter((t) => !t.endsWith('%')).join(' ')
        const parsed = hexOrRgbToRgba(parseColor(colToken, tokens)) ?? [0, 0, 0, 0]
        return { col: parsed, pct: pctToken ? parseFloat(pctToken) / 100 : null }
      }
      const p1 = parsePart(args[0])
      const p2 = parsePart(args[1])
      const w1 = p1.pct ?? (p2.pct !== null ? 1 - p2.pct : 0.5)
      const w2 = p2.pct ?? 1 - w1
      const total = w1 + w2 || 1
      const a1 = p1.col[3] * (w1 / total)
      const a2 = p2.col[3] * (w2 / total)
      const a = a1 + a2
      if (a <= 0.0001) return 'transparent'
      const r = (p1.col[0] * a1 + p2.col[0] * a2) / a
      const g = (p1.col[1] * a1 + p2.col[1] * a2) / a
      const b = (p1.col[2] * a1 + p2.col[2] * a2) / a
      return rgbaToString([r, g, b, clamp01(a)])
    }
  }
  const rgba = hexOrRgbToRgba(v)
  return rgba ? rgbaToString(rgba) : v
}

export function parseLength(raw: string, baseFontPx = DEFAULT_BASE_FONT): number | string | undefined {
  const v = raw.trim()
  if (v === '0' || v === 'none') return 0
  if (v === 'auto') return 'auto'
  if (v.endsWith('%')) return v
  if (v.endsWith('px')) return parseFloat(v)
  if (v.endsWith('em') || v.endsWith('rem')) return round2(parseFloat(v) * baseFontPx)
  if (/^-?\d*\.?\d+$/.test(v)) return parseFloat(v)
  return undefined
}

export function parseLetterSpacing(raw: string, fontSizePx = DEFAULT_BASE_FONT): number | undefined {
  const v = raw.trim()
  if (v === 'normal' || v === '0') return 0
  if (v.endsWith('px')) return parseFloat(v)
  if (v.endsWith('em')) return round2(parseFloat(v) * fontSizePx)
  return undefined
}

export function parseLineHeight(raw: string, fontSizePx = DEFAULT_BASE_FONT): number | undefined {
  const v = raw.trim()
  if (v === 'normal') return undefined
  if (v.endsWith('px')) return parseFloat(v)
  if (v.endsWith('em')) return round2(parseFloat(v) * fontSizePx)
  if (/^\d*\.?\d+$/.test(v)) return round2(parseFloat(v) * fontSizePx)
  return undefined
}

export function parseFontShorthand(raw: string): Record<string, unknown> {
  // Ex.: "500 46px/1 Geist,system-ui,sans-serif" ou "600 15.5px/1.5 Geist,sans-serif"
  const m = raw
    .trim()
    .match(/^(?:(\d{3}|bold|normal)\s+)?(\d+(?:\.\d+)?px)(?:\/(\d+(?:\.\d+)?(?:px|em)?))?\s+(.+)$/i)
  if (!m) return {}
  const [, weight, sizeStr, lhStr, familyRaw] = m
  const fontSize = parseFloat(sizeStr)
  const out: Record<string, unknown> = { fontSize }
  if (weight) out.fontWeight = weight === 'bold' ? '700' : weight === 'normal' ? '400' : weight
  if (lhStr) {
    const lh = parseLineHeight(lhStr, fontSize)
    if (lh !== undefined) out.lineHeight = lh
  }
  const firstFamily = familyRaw.split(',')[0].trim().replace(/^['"]|['"]$/g, '')
  if (firstFamily) out.fontFamily = firstFamily
  return out
}

export function parseCubicBezier(raw: string): [number, number, number, number] | null {
  const m = raw.trim().match(/^cubic-bezier\(\s*([^)]+)\)$/)
  if (!m) return null
  const nums = m[1].split(',').map((s) => parseFloat(s.trim()))
  if (nums.length !== 4 || nums.some(Number.isNaN)) return null
  return [nums[0], nums[1], nums[2], nums[3]]
}

export function parseBoxShadow(
  raw: string,
  tokens: TokenMap = {},
): { shadow?: ShadowStyle; insetBorder?: InsetBorderStyle } {
  const v = resolveVars(raw, tokens)
  if (v === 'none') return {}
  const firstLayer = splitTopLevelComma(v)[0].trim()
  const parts = splitTopLevelSpace(firstLayer)
  const isInset = parts[0] === 'inset'
  const nums = (isInset ? parts.slice(1) : parts).filter((p) => /^-?[\d.]+(?:px)?$/.test(p)).map(parseFloat)
  const colPart = parts.find((p) => !/^(?:inset|-?[\d.]+(?:px)?)$/.test(p)) ?? 'rgba(0,0,0,0.1)'
  const color = parseColor(colPart, tokens)

  if (isInset) {
    const [x = 0, y = 0] = nums
    const insetBorder: InsetBorderStyle = {}
    if (x > 0) {
      insetBorder.borderLeftWidth = x
      insetBorder.borderLeftColor = color
    } else if (x < 0) {
      insetBorder.borderRightWidth = Math.abs(x)
      insetBorder.borderRightColor = color
    }
    if (y > 0) {
      insetBorder.borderTopWidth = y
      insetBorder.borderTopColor = color
    } else if (y < 0) {
      insetBorder.borderBottomWidth = Math.abs(y)
      insetBorder.borderBottomColor = color
    }
    return { insetBorder }
  }

  const [x = 0, y = 0, blur = 0] = nums
  const rgba = hexOrRgbToRgba(color) ?? [0, 0, 0, 0.1]
  return {
    shadow: {
      shadowColor: rgbaToString([rgba[0], rgba[1], rgba[2], 1]),
      shadowOffset: { width: x, height: y },
      shadowOpacity: rgba[3],
      shadowRadius: round2(blur / 2),
      elevation: Math.max(1, Math.round(blur / 4)),
    },
  }
}

function expandBoxValues(raw: string, baseFontPx: number): (number | string)[] {
  return splitTopLevelSpace(raw)
    .map((p) => parseLength(p, baseFontPx))
    .filter((x): x is number | string => x !== undefined)
}

function assignQuad(
  style: Record<string, unknown>,
  prefix: 'padding' | 'margin',
  vals: (number | string)[],
): void {
  if (vals.length === 1) style[prefix] = vals[0]
  else if (vals.length === 2) {
    style[`${prefix}Vertical`] = vals[0]
    style[`${prefix}Horizontal`] = vals[1]
  } else if (vals.length === 3) {
    style[`${prefix}Top`] = vals[0]
    style[`${prefix}Horizontal`] = vals[1]
    style[`${prefix}Bottom`] = vals[2]
  } else if (vals.length >= 4) {
    style[`${prefix}Top`] = vals[0]
    style[`${prefix}Right`] = vals[1]
    style[`${prefix}Bottom`] = vals[2]
    style[`${prefix}Left`] = vals[3]
  }
}

export function parseCssDeclarations(
  decls: Record<string, string>,
  tokens: TokenMap = {},
): RnStyleResult {
  const style: Record<string, unknown> = {}
  const unsupported: string[] = []
  let insetBorder: InsetBorderStyle | undefined

  const fontPre = decls.font ? parseFontShorthand(resolveVars(decls.font, tokens)) : {}
  const baseFontPx =
    typeof fontPre.fontSize === 'number'
      ? fontPre.fontSize
      : decls['font-size']
        ? parseFloat(resolveVars(decls['font-size'], tokens)) || DEFAULT_BASE_FONT
        : DEFAULT_BASE_FONT

  for (const [prop, rawVal] of Object.entries(decls)) {
    const val = resolveVars(rawVal, tokens)
    switch (prop) {
      case 'font':
        Object.assign(style, parseFontShorthand(val))
        break
      case 'font-size': {
        const l = parseLength(val, baseFontPx)
        if (typeof l === 'number') style.fontSize = l
        break
      }
      case 'font-weight':
        style.fontWeight = val
        break
      case 'font-family':
        style.fontFamily = val.split(',')[0].trim().replace(/^['"]|['"]$/g, '')
        break
      case 'line-height': {
        const lh = parseLineHeight(val, baseFontPx)
        if (lh !== undefined) style.lineHeight = lh
        break
      }
      case 'letter-spacing': {
        const ls = parseLetterSpacing(val, baseFontPx)
        if (ls !== undefined) style.letterSpacing = ls
        break
      }
      case 'font-variant-numeric':
        if (val.includes('tabular-nums')) style.fontVariant = ['tabular-nums']
        break
      case 'text-align':
        style.textAlign = val
        break
      case 'text-decoration':
        style.textDecorationLine = val.includes('line-through')
          ? 'line-through'
          : val.includes('underline')
            ? 'underline'
            : 'none'
        break
      case 'color':
        style.color = parseColor(val, tokens)
        break
      case 'background':
      case 'background-color':
        if (!val.includes('gradient(')) style.backgroundColor = parseColor(val, tokens)
        else unsupported.push(`${prop}:${val}`)
        break
      case 'opacity':
        style.opacity = parseFloat(val)
        break
      case 'width':
      case 'height':
      case 'min-width':
      case 'min-height':
      case 'max-width':
      case 'max-height':
      case 'top':
      case 'right':
      case 'bottom':
      case 'left':
      case 'gap':
      case 'row-gap':
      case 'column-gap': {
        const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
        const l = parseLength(val, baseFontPx)
        if (l !== undefined) style[camel] = l
        break
      }
      case 'inset': {
        const vals = expandBoxValues(val, baseFontPx)
        if (vals.length === 1) {
          style.top = vals[0]
          style.right = vals[0]
          style.bottom = vals[0]
          style.left = vals[0]
        }
        break
      }
      case 'padding':
        assignQuad(style, 'padding', expandBoxValues(val, baseFontPx))
        break
      case 'padding-top':
      case 'padding-right':
      case 'padding-bottom':
      case 'padding-left':
      case 'margin-top':
      case 'margin-right':
      case 'margin-bottom':
      case 'margin-left': {
        const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
        const l = parseLength(val, baseFontPx)
        if (l !== undefined) style[camel] = l
        break
      }
      case 'margin':
        assignQuad(style, 'margin', expandBoxValues(val, baseFontPx))
        break
      case 'border-radius': {
        const vals = expandBoxValues(val, baseFontPx)
        if (vals.length === 1) style.borderRadius = vals[0]
        else if (vals.length === 4) {
          style.borderTopLeftRadius = vals[0]
          style.borderTopRightRadius = vals[1]
          style.borderBottomRightRadius = vals[2]
          style.borderBottomLeftRadius = vals[3]
        }
        break
      }
      case 'border': {
        if (val === '0' || val === 'none') style.borderWidth = 0
        else {
          const m = val.match(/^([\d.]+px)\s+\w+\s+(.+)$/)
          if (m) {
            style.borderWidth = parseFloat(m[1])
            style.borderColor = parseColor(m[2], tokens)
          }
        }
        break
      }
      case 'box-shadow': {
        const parsed = parseBoxShadow(val, tokens)
        if (parsed.shadow) Object.assign(style, parsed.shadow)
        if (parsed.insetBorder) insetBorder = parsed.insetBorder
        break
      }
      case 'display':
        if (val === 'none') style.display = 'none'
        break
      case 'flex': {
        const parts = splitTopLevelSpace(val)
        if (parts.length === 1 && /^\d*\.?\d+$/.test(parts[0])) style.flex = parseFloat(parts[0])
        else if (parts.length === 3 && parts[0] === '0' && parts[1] === '0') {
          style.flexGrow = 0
          style.flexShrink = 0
          const basis = parseLength(parts[2], baseFontPx)
          if (basis !== undefined) style.flexBasis = basis
        }
        break
      }
      case 'flex-direction':
        style.flexDirection = val
        break
      case 'flex-wrap':
        style.flexWrap = val
        break
      case 'align-items':
        style.alignItems = val === 'start' ? 'flex-start' : val === 'end' ? 'flex-end' : val
        break
      case 'justify-content':
        style.justifyContent =
          val === 'start' ? 'flex-start' : val === 'end' ? 'flex-end' : val
        break
      case 'align-self':
        style.alignSelf = val
        break
      case 'place-items':
        if (val === 'center') {
          style.alignItems = 'center'
          style.justifyContent = 'center'
        }
        break
      case 'position':
        if (val === 'absolute' || val === 'relative') style.position = val
        break
      case 'overflow':
        if (val === 'hidden' || val === 'visible' || val === 'scroll') style.overflow = val
        break
      case 'z-index':
        style.zIndex = parseInt(val, 10)
        break
      case 'aspect-ratio':
        style.aspectRatio = parseFloat(val)
        break
      default:
        unsupported.push(`${prop}:${val}`)
    }
  }

  return { style, insetBorder, unsupported }
}
