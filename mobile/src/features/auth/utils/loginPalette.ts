import { darkColors, lightColors } from '../../../theme/tokens'

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
  const c = isDark ? darkColors : lightColors
  return {
    acc: c.acc,
    page: c.page,
    bg: c.bg,
    surf: c.surf,
    btn: c.btn,
    ink: c.ink,
    muted: c.muted,
    line: c.line,
    hairline: c.hairline,
    accent: c.acc,
    blue: c.blue,
    blueBg: c.blueBg,
    greenBg: c.greenBg,
    orange: c.orange,
    orangeBg: c.orangeBg,
    red: c.red,
    redBg: c.redBg,
    purple: c.purple,
    purpleBg: c.purpleBg,
    teal: c.teal,
    tealBg: c.tealBg,
    fin: c.fin,
    finBg: c.finBg,
    finBarBg: isDark ? '#162c47' : '#c2deff',
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
