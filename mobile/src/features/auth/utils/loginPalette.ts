import { getRawTokens, token } from '../../../ds/tokens'
import { parseColor } from '../../../prototype/cssToRn'

export interface LoginPalette {
  acc: string
  page: string
  bg: string
  surf: string
  btn: string
  ink: string
  muted: string
  line: string
  hairline: string
  accent: string
  blue: string
  blueBg: string
  greenBg: string
  orange: string
  orangeBg: string
  red: string
  redBg: string
  purple: string
  purpleBg: string
  teal: string
  tealBg: string
  fin: string
  finBg: string
  finBarBg: string
  cardRing: string
  wa: string
  photoPaper: string
  photoLine: string
}

function buildPalette(isDark: boolean): LoginPalette {
  const t = (k: string) => token(k, isDark)
  const raw = getRawTokens(isDark)
  return {
    acc: t('--acc'),
    page: t('--page'),
    bg: t('--bg'),
    surf: t('--surf'),
    btn: t('--btn'),
    ink: t('--ink'),
    muted: t('--muted'),
    line: t('--line'),
    hairline: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(10, 10, 10, 0.065)',
    accent: t('--acc'),
    blue: t('--blue'),
    blueBg: t('--blue-bg'),
    greenBg: t('--green-bg'),
    orange: t('--orange'),
    orangeBg: t('--orange-bg'),
    red: t('--red'),
    redBg: t('--red-bg'),
    purple: t('--purple'),
    purpleBg: t('--purple-bg'),
    teal: t('--teal'),
    tealBg: t('--teal-bg'),
    fin: t('--fin'),
    finBg: t('--fin-bg'),
    finBarBg: parseColor('color-mix(in srgb,var(--blue) 25%,var(--bg))', raw),
    cardRing: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.035)',
    wa: '#25d366',
    photoPaper: isDark ? '#3a3428' : '#efe7d2',
    photoLine: '#b9ae93',
  }
}

const LIGHT = buildPalette(false)
const DARK = buildPalette(true)

export function loginPalette(isDark: boolean): LoginPalette {
  return isDark ? DARK : LIGHT
}
