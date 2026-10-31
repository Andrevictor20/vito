import React from 'react';
import Svg, {
  Defs,
  LinearGradient,
  Rect,
  Stop,
  Path,
  Circle,
  Line,
  Polyline,
} from 'react-native-svg';
import type { OverlayActionKind, OverlayThemeTokens } from './voiceOverlayHelpers';

export const ActionCategoryIcon: React.FC<{ kind: OverlayActionKind; color: string }> = ({
  kind,
  color,
}) => {
  switch (kind) {
    case 'cal':
      return (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Rect x="3" y="4" width="18" height="18" rx="2" />
          <Line x1="16" y1="2" x2="16" y2="6" />
          <Line x1="8" y1="2" x2="8" y2="6" />
          <Line x1="3" y1="10" x2="21" y2="10" />
        </Svg>
      );
    case 'check':
      return (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <Polyline points="20 6 9 17 4 12" />
        </Svg>
      );
    case 'wa':
      return (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </Svg>
      );
    case 'coin':
    default:
      return (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Line x1="12" y1="1" x2="12" y2="23" />
          <Path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </Svg>
      );
  }
};

export const MulticolorGradientSvg: React.FC<{ id: string; theme: OverlayThemeTokens }> = ({
  id,
  theme,
}) => (
  <Svg width="100%" height="100%" viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={theme.blue} />
        <Stop offset="25%" stopColor={theme.red} />
        <Stop offset="50%" stopColor={theme.orange} />
        <Stop offset="75%" stopColor={theme.acc} />
        <Stop offset="100%" stopColor={theme.purple} />
      </LinearGradient>
    </Defs>
    <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
  </Svg>
);

export const EdgeGlowSvg: React.FC<{ theme: OverlayThemeTokens; accentColor: string }> = ({
  theme,
  accentColor,
}) => (
  <Svg width="100%" height={120} preserveAspectRatio="none">
    <Defs>
      <LinearGradient id="edgeColors" x1="0%" y1="0%" x2="100%" y2="0%">
        <Stop offset="0%" stopColor={theme.blue} stopOpacity="0.85" />
        <Stop offset="25%" stopColor={theme.red} stopOpacity="0.85" />
        <Stop offset="50%" stopColor={theme.orange} stopOpacity="0.85" />
        <Stop offset="75%" stopColor={theme.acc} stopOpacity="0.85" />
        <Stop offset="100%" stopColor={theme.purple} stopOpacity="0.85" />
      </LinearGradient>
      <LinearGradient id="edgeFade" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor={theme.bg} stopOpacity="0" />
        <Stop offset="100%" stopColor={accentColor} stopOpacity="0.55" />
      </LinearGradient>
    </Defs>
    <Rect x="0" y="35" width="100%" height={85} fill="url(#edgeColors)" opacity={0.45} />
    <Rect x="0" y="0" width="100%" height={120} fill="url(#edgeFade)" />
  </Svg>
);

export const EyeContextIcon: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <Circle cx="12" cy="12" r="3" />
  </Svg>
);

export const MicToggleIcon: React.FC<{ isMuted: boolean; color: string }> = ({ isMuted, color }) =>
  isMuted ? (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="1" y1="1" x2="23" y2="23" />
      <Path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <Path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <Line x1="12" y1="19" x2="12" y2="23" />
      <Line x1="8" y1="23" x2="16" y2="23" />
    </Svg>
  ) : (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <Line x1="12" y1="19" x2="12" y2="23" />
      <Line x1="8" y1="23" x2="16" y2="23" />
    </Svg>
  );

export const CloseXIcon: React.FC<{ color: string }> = ({ color }) => (
  <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Line x1="18" y1="6" x2="6" y2="18" />
    <Line x1="6" y1="6" x2="18" y2="18" />
  </Svg>
);
