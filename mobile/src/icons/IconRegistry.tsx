import React from 'react'
import iconsData from '../prototype/icons.json'
import { SvgTree, type SvgNode } from './SvgTree'
import { GmailOfficialLogo, GoogleDriveOfficialLogo } from './GoogleBrandLogos'

export type AppLogoId = keyof typeof iconsData.LOGO
export type AiLogoId = keyof typeof iconsData.AILOGO
export type BankIconId = keyof typeof iconsData.BANK_ICON

export type BrandGroup = 'app' | 'ai' | 'bank'

export interface BrandLogoProps {
  group: BrandGroup
  id: string
  size?: number
  color?: string
}

const APP_VIEWBOX_OVERRIDES: Record<string, string> = {
  maps: '0 0 256 368',
  notion: '-4 -4 264 276',
}

/** Renderiza logos oficiais multi-camada extraídos do protótipo (LOGO, AILOGO, BANK_ICON). */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  group,
  id,
  size = 24,
  color = '#0a0a0a',
}) => {
  if (group === 'app' && id === 'gmail') {
    return <GmailOfficialLogo size={size} />
  }
  if (group === 'app' && id === 'gdrive') {
    return <GoogleDriveOfficialLogo size={size} />
  }

  const dict = (
    group === 'app'
      ? iconsData.LOGO
      : group === 'ai'
        ? iconsData.AILOGO
        : iconsData.BANK_ICON
  ) as unknown as Record<string, SvgNode | null | undefined>

  const tree = dict[id]
  if (!tree) return null
  const viewBoxOverride = group === 'app' ? APP_VIEWBOX_OVERRIDES[id] : undefined
  return <SvgTree tree={tree} size={size} color={color} viewBoxOverride={viewBoxOverride} />
}

export interface ProtoIconProps {
  /** Índice 1-based em `icons.json#inlineIcons`, ou `'vito' | 'spark' | 'spk'`. */
  name: number | 'vito' | 'spark' | 'spk'
  size?: number
  width?: number
  height?: number
  color?: string
}

/** Renderiza ícones inline da interface exatamente como no protótipo (sem bibliotecas genéricas). */
export const ProtoIcon: React.FC<ProtoIconProps> = ({
  name,
  size = 22,
  width,
  height,
  color = '#0a0a0a',
}) => {
  let tree: SvgNode | undefined
  if (name === 'vito') {
    tree = iconsData.symbols?.vito?.tree as SvgNode | undefined
  } else if (name === 'spark') {
    tree = iconsData.SPARK as SvgNode | undefined
  } else if (name === 'spk') {
    tree = iconsData.SPK as SvgNode | undefined
  } else {
    tree = (iconsData.inlineIcons as unknown as Array<{ index: number; tree: SvgNode }>).find(
      (i) => i.index === name,
    )?.tree
  }

  if (!tree) return null
  return <SvgTree tree={tree} size={size} width={width} height={height} color={color} />
}
