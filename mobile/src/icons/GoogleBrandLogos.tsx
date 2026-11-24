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
