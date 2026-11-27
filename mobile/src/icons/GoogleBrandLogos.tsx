import React from 'react'
import Svg, { Path } from 'react-native-svg'

export interface GoogleBrandLogoProps {
  size?: number
}

/** Logo oficial do Gmail (envelope M em 5 cores, sem transform/gradientUnits quebrados no Android). */
export const GmailOfficialLogo: React.FC<GoogleBrandLogoProps> = ({ size = 24 }) => (
  <Svg width={size} height={size} viewBox="52 42 88 66">
    <Path fill="#4285F4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
    <Path fill="#34A853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
    <Path fill="#FBBC04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
    <Path fill="#EA4335" d="M72 74V48l24 18 24-18v26L96 92" />
    <Path fill="#C5221F" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
  </Svg>
)

/** Logo oficial do Google Drive (triângulo em 6 segmentos, sem sobreposição opaca). */
export const GoogleDriveOfficialLogo: React.FC<GoogleBrandLogoProps> = ({ size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 87.3 78">
    <Path
      fill="#0066DA"
      d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
    />
    <Path
      fill="#00AC47"
      d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
    />
    <Path
      fill="#EA4335"
      d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
    />
    <Path
      fill="#00832D"
      d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
    />
    <Path
      fill="#2684FC"
      d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
    />
    <Path
      fill="#FFBA00"
      d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
    />
  </Svg>
)

export interface GoogleIconProps {
  size?: number
}

/** Logo oficial multicolorido do Google (Sign-In CTA). */
export const GoogleIcon: React.FC<GoogleIconProps> = ({ size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <Path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <Path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <Path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </Svg>
)
