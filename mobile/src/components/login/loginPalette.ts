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
  wa: string
  photoPaper: string
  photoLine: string
}

const LIGHT: LoginPalette = {
  acc: '#0aa55c',
  page: '#efefef',
  bg: '#ffffff',
  surf: '#f4f4f4',
  btn: '#ececec',
  ink: '#0a0a0a',
  muted: '#595959',
  line: '#e6e6e6',
  hairline: 'rgba(10, 10, 10, 0.065)',
  accent: '#0aa55c',
  blue: '#0a7cff',
  blueBg: '#e6f1ff',
  greenBg: '#e3f6ec',
  orange: '#f08300',
  orangeBg: '#fff0d9',
  red: '#ff2d46',
  redBg: '#ffe8ec',
  purple: '#ff2fa0',
  purpleBg: '#ffe6f4',
  teal: '#0aa5b5',
  tealBg: '#dff4f6',
  fin: '#d98a00',
  finBg: '#fff2d6',
  wa: '#25d366',
  photoPaper: '#efe7d2',
  photoLine: '#b9ae93',
}

const DARK: LoginPalette = {
  acc: '#2dd17f',
  page: '#000000',
  bg: '#0a0a0a',
  surf: '#171717',
  btn: '#262626',
  ink: '#f5f5f5',
  muted: '#8c8c8c',
  line: '#262626',
  hairline: 'rgba(255, 255, 255, 0.07)',
  accent: '#2dd17f',
  blue: '#3b93ff',
  blueBg: '#0f2540',
  greenBg: '#0f2f22',
  orange: '#ffa733',
  orangeBg: '#35230f',
  red: '#ff5468',
  redBg: '#3a1219',
  purple: '#ff55b0',
  purpleBg: '#3a1229',
  teal: '#3cc4d0',
  tealBg: '#10343a',
  fin: '#ffb938',
  finBg: '#3a2b0b',
  wa: '#25d366',
  photoPaper: '#3a3428',
  photoLine: '#b9ae93',
}

export function loginPalette(isDark: boolean): LoginPalette {
  return isDark ? DARK : LIGHT
}
