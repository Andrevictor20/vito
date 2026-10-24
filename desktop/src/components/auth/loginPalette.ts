export interface LoginPalette {
  acc: string;
  page: string;
  bg: string;
  surf: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  blue: string;
  blueBg: string;
  greenBg: string;
  orange: string;
  orangeBg: string;
  red: string;
  redBg: string;
  purple: string;
  purpleBg: string;
  wa: string;
  photoPaper: string;
  photoLine: string;
}

const LIGHT: LoginPalette = {
  acc: '#0b9a5f',
  page: '#dde1df',
  bg: '#ffffff',
  surf: '#f2f4f3',
  ink: '#17191b',
  muted: '#69706d',
  line: '#d2d7d4',
  accent: '#1fb97a',
  blue: '#2b7fd4',
  blueBg: '#e4effb',
  greenBg: '#ddf4e8',
  orange: '#d9681a',
  orangeBg: '#fbebdb',
  red: '#d6355a',
  redBg: '#fde6ec',
  purple: '#7a4fe0',
  purpleBg: '#eee8fd',
  wa: '#25d366',
  photoPaper: '#efe7d2',
  photoLine: '#b9ae93',
};

const DARK: LoginPalette = {
  acc: '#34d399',
  page: '#050606',
  bg: '#0d0f10',
  surf: '#191c1e',
  ink: '#f1f3f2',
  muted: '#98a19d',
  line: '#2c3134',
  accent: '#34d399',
  blue: '#5aa2ee',
  blueBg: '#16283b',
  greenBg: '#12302a',
  orange: '#ff9a52',
  orangeBg: '#35230f',
  red: '#ff6b8a',
  redBg: '#3a1620',
  purple: '#a58bff',
  purpleBg: '#241a42',
  wa: '#25d366',
  photoPaper: '#3a3428',
  photoLine: '#b9ae93',
};

export function loginPalette(isDark: boolean): LoginPalette {
  return isDark ? DARK : LIGHT;
}
