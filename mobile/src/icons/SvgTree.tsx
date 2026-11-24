import React from 'react'
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Polyline,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'

export interface SvgNode {
  tag?: string
  attrs?: Record<string, string | undefined>
  children?: SvgNode[]
  text?: string
}

const ATTR_MAP: Record<string, string> = {
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset',
  'stroke-opacity': 'strokeOpacity',
  'fill-opacity': 'fillOpacity',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
  'clip-path': 'clipPath',
  'stop-color': 'stopColor',
  'stop-opacity': 'stopOpacity',
  'gradientunits': 'gradientUnits',
  'gradienttransform': 'gradientTransform',
}

function mapAttrs(
  attrs: Record<string, string | undefined> | undefined,
  color: string,
): Record<string, unknown> {
  if (!attrs) return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined) continue
    const lower = k.toLowerCase()
    if (lower === 'aria-hidden' || lower === 'class' || lower === 'style' || lower === 'xmlns') continue
    const prop = ATTR_MAP[lower] ?? k
    out[prop] = v === 'currentColor' ? color : v
  }
  return out
}

function renderNode(node: SvgNode, key: string, color: string): React.ReactElement | null {
  if (!node.tag) return null
  const props = mapAttrs(node.attrs, color)
  const children = node.children
    ?.map((c, idx) => renderNode(c, `${key}.${idx}`, color))
    .filter((c): c is React.ReactElement => c !== null)

  switch (node.tag) {
    case 'defs':
      return <Defs key={key}>{children}</Defs>
    case 'lineargradient':
    case 'linearGradient':
      return (
        <LinearGradient key={key} {...props}>
          {children}
        </LinearGradient>
      )
    case 'radialgradient':
    case 'radialGradient':
      return (
        <RadialGradient key={key} {...props}>
          {children}
        </RadialGradient>
      )
    case 'stop':
      return <Stop key={key} {...props} />
    case 'clippath':
    case 'clipPath':
      return (
        <ClipPath key={key} {...props}>
          {children}
        </ClipPath>
      )
    case 'g':
      return (
        <G key={key} {...props}>
          {children}
        </G>
      )
    case 'path':
      return <Path key={key} {...props} />
    case 'rect':
      return <Rect key={key} {...props} />
    case 'circle':
      return <Circle key={key} {...props} />
    case 'ellipse':
      return <Ellipse key={key} {...props} />
    case 'polygon':
      return <Polygon key={key} {...props} />
    case 'polyline':
      return <Polyline key={key} {...props} />
    case 'line':
      return <Line key={key} {...props} />
    default:
      return null
  }
}

export interface SvgTreeProps {
  tree: SvgNode
  size?: number
  width?: number
  height?: number
  color?: string
  viewBoxOverride?: string
}

/** Renderiza exatamente a árvore SVG extraída de icons.json via react-native-svg. */
export const SvgTree: React.FC<SvgTreeProps> = ({
  tree,
  size = 24,
  width,
  height,
  color = '#0a0a0a',
  viewBoxOverride,
}) => {
  const attrs = mapAttrs(tree.attrs, color)
  const viewBox = viewBoxOverride ?? (attrs.viewBox as string | undefined) ?? '0 0 24 24'
  const w = width ?? size
  const h = height ?? size
  const stroke = attrs.stroke as string | undefined
  const fill =
    (attrs.fill as string | undefined) ??
    (stroke ? 'none' : color)
  const strokeWidth = attrs.strokeWidth as string | number | undefined
  const strokeLinecap = attrs.strokeLinecap as 'butt' | 'round' | 'square' | undefined
  const strokeLinejoin = attrs.strokeLinejoin as 'miter' | 'round' | 'bevel' | undefined

  return (
    <Svg
      width={w}
      height={h}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap={strokeLinecap}
      strokeLinejoin={strokeLinejoin}
    >
      {tree.children?.map((c, idx) => renderNode(c, `n${idx}`, color))}
    </Svg>
  )
}
