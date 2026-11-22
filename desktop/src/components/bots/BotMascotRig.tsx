import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { BotAnimState, BotSkin } from '../../types/bot';
import { resolveSkin } from './mascotPalettes';

export interface BotMascotRigProps {
  skin?: BotSkin;
  state?: BotAnimState;
  size?: number;
  animated?: boolean;
  darkStage?: boolean;
  reaction?: 'hat' | 'bowtie' | 'eyes' | null;
  className?: string;
}

export const BotMascotRig: React.FC<BotMascotRigProps> = ({
  skin,
  state = 'idle',
  size = 60,
  animated = true,
  darkStage,
  reaction = null,
  className = '',
}) => {
  const { isDark } = useTheme();
  const c = resolveSkin(skin, darkStage ?? isDark);

  const showDefaultEyes = state !== 'happy' && state !== 'sleeping';
  const showHappyEyes = state === 'happy';
  const showSleepingEyes = state === 'sleeping';

  const hatStyle: React.CSSProperties =
    reaction === 'hat'
      ? { transform: 'translate(16px, -26px) rotate(20deg)', transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)' }
      : { transition: 'transform 0.35s ease' };

  const bowtieStyle: React.CSSProperties =
    reaction === 'bowtie'
      ? {
          transformOrigin: '250px 316px',
          transform: 'rotate(360deg) scale(1.18)',
          transition: 'transform 0.55s ease',
        }
      : { transformOrigin: '250px 316px', transition: 'transform 0.3s ease' };

  const eyeStyle: React.CSSProperties =
    reaction === 'eyes'
      ? { transformOrigin: 'center 211px', transform: 'scaleY(0.08)', transition: 'transform 0.14s ease' }
      : { transformOrigin: 'center 211px', transition: 'transform 0.14s ease' };

  return (
    <svg
      viewBox="0 0 500 500"
      width={size}
      height={size}
      shapeRendering="geometricPrecision"
      className={`shrink-0 select-none ${animated ? `mascot-anim state-${state}` : ''} ${className}`}
      data-anim-state={state}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g className={animated && state === 'idle' ? 'animate-pulse' : undefined} style={{ animationDuration: '4s' }}>
        {state === 'happy' && (
          <g stroke={c.bowtie} strokeWidth="10" strokeLinecap="round" fill="none">
            <path d="M 74 140 L 74 176 M 56 158 L 92 158" />
            <path d="M 432 168 L 432 198 M 417 183 L 447 183" />
            <circle cx="105" cy="96" r="6" fill={c.bowtie} stroke="none" />
            <circle cx="410" cy="238" r="6" fill={c.bowtie} stroke="none" />
          </g>
        )}

        {state === 'surprised' && (
          <g stroke={c.bowtie} strokeWidth="12" strokeLinecap="round">
            <line x1="115" y1="88" x2="90" y2="62" />
            <line x1="168" y1="54" x2="155" y2="22" />
            <line x1="88" y1="142" x2="54" y2="132" />
          </g>
        )}

        {state === 'thinking' && (
          <g fill={c.fill} stroke={c.stroke} strokeWidth="10">
            <circle cx="404" cy="148" r="10" />
            <circle cx="432" cy="112" r="15" />
            <circle cx="456" cy="66" r="21" />
          </g>
        )}

        {state === 'sleeping' && (
          <g fill="none" stroke={c.stroke} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity="0.75">
            <path d="M 386 150 H 414 L 386 180 H 414" />
            <path d="M 412 115 H 444 L 412 149 H 444" />
            <path d="M 436 80 H 472 L 436 118 H 472" />
          </g>
        )}

        <g className="rig-body">
          <path d="M 53 372 C 41 360, 35 345, 35 329 A 36 43 0 0 1 71 286 A 30 25 0 0 1 101 311 A 18 17 0 0 1 83 328 C 78 342, 78 350, 88 354 A 40 45 0 0 0 53 372 Z" fill={c.fill} stroke="none" />
          <path d="M 447 372 C 459 360, 465 345, 465 329 A 36 43 0 0 0 429 286 A 30 25 0 0 0 399 311 A 18 17 0 0 0 417 328 C 422 342, 422 350, 412 354 A 40 45 0 0 1 447 372 Z" fill={c.fill} stroke="none" />
          <path d="M 88 354 C 122 354, 141.8 325.8, 126 301 A 147 147 0 1 1 374 301 C 358.2 325.8, 378 354, 412 354 A 40 45 0 0 1 452 399 A 52 53 0 0 1 400 452 C 380 452, 362 447, 351 434 A 53 53 0 0 1 303 465 A 53 53 0 0 1 250 412 A 53 53 0 0 1 197 465 A 53 53 0 0 1 149 434 C 138 447, 120 452, 100 452 A 52 53 0 0 1 48 399 A 40 45 0 0 1 88 354 Z" fill={c.fill} stroke="none" />
          <path d="M 53 372 C 41 360, 35 345, 35 329 A 36 43 0 0 1 71 286 A 30 25 0 0 1 101 311 A 18 17 0 0 1 83 328 A 13 14 0 0 1 70 314" fill="none" stroke={c.stroke} strokeWidth="16.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 447 372 C 459 360, 465 345, 465 329 A 36 43 0 0 0 429 286 A 30 25 0 0 0 399 311 A 18 17 0 0 0 417 328 A 13 14 0 0 0 430 314" fill="none" stroke={c.stroke} strokeWidth="16.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 88 354 C 122 354, 141.8 325.8, 126 301 A 147 147 0 1 1 374 301 C 358.2 325.8, 378 354, 412 354" fill="none" stroke={c.stroke} strokeWidth="16.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 149 434 C 138 447, 120 452, 100 452 A 52 53 0 0 1 48 399 A 40 45 0 0 1 88 354 A 29 31 0 0 1 117 385 A 21 27 0 0 1 96 412 A 17 17 0 0 1 79 395 A 8 11 0 0 1 86 384" fill="none" stroke={c.stroke} strokeWidth="16.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 351 434 C 362 447, 380 452, 400 452 A 52 53 0 0 0 452 399 A 40 45 0 0 0 412 354 A 29 31 0 0 0 383 385 A 21 27 0 0 0 404 412 A 17 17 0 0 0 421 395 A 8 11 0 0 0 414 384" fill="none" stroke={c.stroke} strokeWidth="16.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 250 368 L 250 412 A 53 53 0 0 1 197 465 A 53 53 0 0 1 144 412 A 42 45 0 0 1 186 367 A 34 32 0 0 1 220 399 A 24 27 0 0 1 196 426 A 21 20 0 0 1 175 406 A 8 12 0 0 1 183 394" fill="none" stroke={c.stroke} strokeWidth="16.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M 250 368 L 250 412 A 53 53 0 0 0 303 465 A 53 53 0 0 0 356 412 A 42 45 0 0 0 314 367 A 34 32 0 0 0 280 399 A 24 27 0 0 0 304 426 A 21 20 0 0 0 325 406 A 8 12 0 0 0 317 394" fill="none" stroke={c.stroke} strokeWidth="16.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        <g style={bowtieStyle}>
          <path d="M 211 299 C 211 295, 215 293, 219 295 L 244 307 L 244 325 L 219 337 C 215 339, 211 337, 211 333 Z" fill={c.bowtie} />
          <path d="M 289 299 C 289 295, 285 293, 281 295 L 256 307 L 256 325 L 281 337 C 285 339, 289 337, 289 333 Z" fill={c.bowtie} />
          <rect x="239" y="304" width="22" height="24" rx="7" fill={c.bowtie} />
        </g>

        <g className="rig-eyes-group">
          {showDefaultEyes && (
            <g style={eyeStyle}>
              <rect x="195" y="176" width="28" height="71" rx="14" fill={c.eyes} />
              <rect x="277" y="176" width="28" height="71" rx="14" fill={c.eyes} />
            </g>
          )}
          {showHappyEyes && (
            <g fill="none" stroke={c.eyes} strokeWidth="18" strokeLinecap="round">
              <path d="M 190 220 C 198 194, 220 194, 228 220" />
              <path d="M 272 220 C 280 194, 302 194, 310 220" />
            </g>
          )}
          {showSleepingEyes && (
            <g fill="none" stroke={c.eyes} strokeWidth="16" strokeLinecap="round">
              <path d="M 190 214 C 198 232, 220 232, 228 214" />
              <path d="M 272 214 C 280 232, 302 232, 310 214" />
            </g>
          )}
        </g>

        <g style={hatStyle}>
          <g transform="translate(332, 92) rotate(27.5)">
            <rect x="-42" y="-64" width="84" height="66" rx="22" fill={c.hat} stroke={c.hat} strokeWidth="8" />
            <rect x="-33" y="-18" width="66" height="14" rx="2" fill={c.band} />
            <path d="M -64 -2 Q 0 11 64 -2" fill="none" stroke={c.hat} strokeWidth="15" strokeLinecap="round" />
          </g>
        </g>
      </g>
    </svg>
  );
};
