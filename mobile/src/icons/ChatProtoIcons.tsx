import React from 'react'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

export interface ChatSvgProps {
  color?: string
  size?: number
}

/** .sg cal (linha 1766) */
export const SgCalIcon: React.FC<ChatSvgProps> = ({ color = '#0a7cff', size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
    <Rect x="3" y="5" width="18" height="16" rx="3" />
    <Path d="M8 3v4M16 3v4M3 10h18" />
  </Svg>
)

/** .sg check-circle (linha 1767) */
export const SgTasksIcon: React.FC<ChatSvgProps> = ({ color = '#ff2fa0', size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="9" />
    <Path d="M8 12.5l3 3 5-6" />
  </Svg>
)

/** .sg cup/coffee (linha 1768) */
export const SgCupIcon: React.FC<ChatSvgProps> = ({ color = '#f08300', size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4zM16 11h2a2 2 0 0 1 0 4h-2" />
  </Svg>
)

/** #c-attach / #c-new (linha 1758, 1772) */
export const PlusSvgIcon: React.FC<ChatSvgProps> = ({ color = '#0a0a0a', size = 19 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
    <Path d="M12 5v14M5 12h14" />
  </Svg>
)

/** #c-mic (linha 1777) */
export const MicSvgIcon: React.FC<ChatSvgProps> = ({ color = '#0a0a0a', size = 19 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Rect x="9" y="3" width="6" height="12" rx="3" />
    <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
)

/** #c-voice waveform .wv (linha 1778) */
export const WaveSvgIcon: React.FC<ChatSvgProps> = ({ color = '#0a0a0a', size = 19 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round">
    <Path d="M4 10v4M8 6v12M12 9v6M16 4v16M20 10v4" />
  </Svg>
)

/** #c-send (linha 1779) */
export const SendUpSvgIcon: React.FC<ChatSvgProps> = ({ color = '#ffffff', size = 19 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 19V5M5 12l7-7 7 7" />
  </Svg>
)

/** Close X (linha 2065) */
export const CloseSvgIcon: React.FC<ChatSvgProps> = ({ color = '#0a0a0a', size = 18 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
    <Path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)

export const ChevronRightSvgIcon: React.FC<ChatSvgProps> = ({ color = '#595959', size = 16 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 6l6 6-6 6" />
  </Svg>
)

export const ChevronDownSvgIcon: React.FC<ChatSvgProps> = ({ color = '#595959', size = 14 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 9l6 6 6-6" />
  </Svg>
)
