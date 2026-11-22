import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export type VitoAuthLogoState = 'gentleman' | 'blink' | 'idle' | 'happy';

interface VitoAnimatedLogoProps {
  className?: string;
  size?: number;
  showWordmark?: boolean;
  state?: VitoAuthLogoState;
  speed?: number;
}

const LEFT_ARM_FILL =
  'M 53 372 C 41 360, 35 345, 35 329 A 36 43 0 0 1 71 286 A 30 25 0 0 1 101 311 A 18 17 0 0 1 83 328 C 78 342, 78 350, 88 354 A 40 45 0 0 0 53 372 Z';
const RIGHT_ARM_FILL =
  'M 447 372 C 459 360, 465 345, 465 329 A 36 43 0 0 0 429 286 A 30 25 0 0 0 399 311 A 18 17 0 0 0 417 328 C 422 342, 422 350, 412 354 A 40 45 0 0 1 447 372 Z';
const BODY_FILL =
  'M 88 354 C 122 354, 141.8 325.8, 126 301 A 147 147 0 1 1 374 301 C 358.2 325.8, 378 354, 412 354 A 40 45 0 0 1 452 399 A 52 53 0 0 1 400 452 C 380 452, 362 447, 351 434 A 53 53 0 0 1 303 465 A 53 53 0 0 1 250 412 A 53 53 0 0 1 197 465 A 53 53 0 0 1 149 434 C 138 447, 120 452, 100 452 A 52 53 0 0 1 48 399 A 40 45 0 0 1 88 354 Z';

const STROKE_PATHS = [
  'M 53 372 C 41 360, 35 345, 35 329 A 36 43 0 0 1 71 286 A 30 25 0 0 1 101 311 A 18 17 0 0 1 83 328 A 13 14 0 0 1 70 314',
  'M 447 372 C 459 360, 465 345, 465 329 A 36 43 0 0 0 429 286 A 30 25 0 0 0 399 311 A 18 17 0 0 0 417 328 A 13 14 0 0 0 430 314',
  'M 88 354 C 122 354, 141.8 325.8, 126 301 A 147 147 0 1 1 374 301 C 358.2 325.8, 378 354, 412 354',
  'M 149 434 C 138 447, 120 452, 100 452 A 52 53 0 0 1 48 399 A 40 45 0 0 1 88 354 A 29 31 0 0 1 117 385 A 21 27 0 0 1 96 412 A 17 17 0 0 1 79 395 A 8 11 0 0 1 86 384',
  'M 351 434 C 362 447, 380 452, 400 452 A 52 53 0 0 0 452 399 A 40 45 0 0 0 412 354 A 29 31 0 0 0 383 385 A 21 27 0 0 0 404 412 A 17 17 0 0 0 421 395 A 8 11 0 0 0 414 384',
  'M 250 368 L 250 412 A 53 53 0 0 1 197 465 A 53 53 0 0 1 144 412 A 42 45 0 0 1 186 367 A 34 32 0 0 1 220 399 A 24 27 0 0 1 196 426 A 21 20 0 0 1 175 406 A 8 12 0 0 1 183 394',
  'M 250 368 L 250 412 A 53 53 0 0 0 303 465 A 53 53 0 0 0 356 412 A 42 45 0 0 0 314 367 A 34 32 0 0 0 280 399 A 24 27 0 0 0 304 426 A 21 20 0 0 0 325 406 A 8 12 0 0 0 317 394',
];

export const VitoAnimatedLogo: React.FC<VitoAnimatedLogoProps> = ({
  className = '',
  size = 40,
  showWordmark = true,
  state = 'blink',
  speed = 1,
}) => {
  const { isDark } = useTheme();
  const fill = isDark ? '#0a0a0a' : '#ffffff';
  const stroke = isDark ? '#f5f5f5' : '#0a0a0a';
  const eyes = isDark ? '#f5f5f5' : '#0a0a0a';
  const hat = isDark ? '#f5f5f5' : '#0a0a0a';
  const band = isDark ? '#0a0a0a' : '#ffffff';
  const bowtie = isDark ? '#2dd17f' : '#0aa55c';

  const animStyle = { '--vito-anim-speed': String(speed) } as React.CSSProperties;

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`} style={animStyle}>
      <style>{`
        .vito-auth-rig .rig-whole,
        .vito-auth-rig .rig-hat,
        .vito-auth-rig .rig-eyes-group,
        .vito-auth-rig .rig-eye-left,
        .vito-auth-rig .rig-eye-right,
        .vito-auth-rig .rig-bowtie {
          transform-box: view-box;
          will-change: transform;
        }
        .vito-auth-rig .rig-whole { transform-origin: 250px 280px; }
        .vito-auth-rig .rig-hat { transform-origin: 332px 104px; }
        .vito-auth-rig .rig-eyes-group { transform-origin: 250px 211.5px; }
        .vito-auth-rig .rig-eye-left { transform-origin: 209px 211.5px; }
        .vito-auth-rig .rig-eye-right { transform-origin: 291px 211.5px; }
        .vito-auth-rig .rig-bowtie { transform-origin: 250px 316px; }

        @keyframes vitoBlinkEyes {
          0%, 44%, 50%, 78%, 84%, 100% { transform: scaleY(1); }
          47%, 81% { transform: scaleY(0.06); }
        }
        @keyframes vitoHatTip {
          0%, 18%, 82%, 100% { transform: translate3d(0,0,0) rotate(0deg); }
          36%, 62% { transform: translate3d(14px,-22px,0) rotate(18deg); }
          48% { transform: translate3d(16px,-25px,0) rotate(21deg); }
        }
        @keyframes vitoGentlemanNod {
          0%, 18%, 82%, 100% { transform: translate3d(0,0,0) rotate(0deg); }
          38%, 60% { transform: translate3d(0,4px,0) rotate(2.5deg); }
        }
        @keyframes vitoGentlemanFace {
          0%, 18%, 82%, 100% { transform: translate3d(0,0,0); }
          38%, 60% { transform: translate3d(3px,4px,0); }
        }
        @keyframes vitoWinkRight {
          0%, 26%, 68%, 100% { transform: scaleY(1); }
          36%, 56% { transform: scaleY(0.08); }
        }
        @keyframes vitoBowtieWiggle {
          0%, 22%, 78%, 100% { transform: rotate(0deg) scale(1); }
          34% { transform: rotate(-7deg) scale(1.06); }
          46% { transform: rotate(7deg) scale(1.06); }
          58% { transform: rotate(-4deg) scale(1.03); }
        }

        .vito-auth-rig.state-blink .rig-eye-left,
        .vito-auth-rig.state-blink .rig-eye-right {
          animation: vitoBlinkEyes calc(3.6s / var(--vito-anim-speed, 1)) infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
        .vito-auth-rig.state-gentleman .rig-whole {
          animation: vitoGentlemanNod calc(3s / var(--vito-anim-speed, 1)) infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
        .vito-auth-rig.state-gentleman .rig-eyes-group {
          animation: vitoGentlemanFace calc(3s / var(--vito-anim-speed, 1)) infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
        .vito-auth-rig.state-gentleman .rig-hat {
          animation: vitoHatTip calc(3s / var(--vito-anim-speed, 1)) infinite cubic-bezier(0.34, 1.45, 0.64, 1);
        }
        .vito-auth-rig.state-gentleman .rig-eye-right {
          animation: vitoWinkRight calc(3s / var(--vito-anim-speed, 1)) infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
        .vito-auth-rig.state-gentleman .rig-bowtie {
          animation: vitoBowtieWiggle calc(3s / var(--vito-anim-speed, 1)) infinite cubic-bezier(0.4, 0, 0.2, 1);
        }
        @media (prefers-reduced-motion: reduce) {
          .vito-auth-rig * {
            animation: none !important;
          }
        }
      `}</style>

      <svg
        width={size}
        height={size}
        viewBox="0 0 500 500"
        shapeRendering="geometricPrecision"
        aria-hidden="true"
        className={`vito-auth-rig state-${state} shrink-0 overflow-visible`}
      >
        <g className="rig-whole">
          <g className="rig-body">
            <path d={LEFT_ARM_FILL} fill={fill} />
            <path d={RIGHT_ARM_FILL} fill={fill} />
            <path d={BODY_FILL} fill={fill} />
            {STROKE_PATHS.map((d, idx) => (
              <path
                key={idx}
                d={d}
                fill="none"
                stroke={stroke}
                strokeWidth="16.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </g>

          <g className="rig-bowtie">
            <path
              d="M 211 299 C 211 295, 215 293, 219 295 L 244 307 L 244 325 L 219 337 C 215 339, 211 337, 211 333 Z"
              fill={bowtie}
            />
            <path
              d="M 289 299 C 289 295, 285 293, 281 295 L 256 307 L 256 325 L 281 337 C 285 339, 289 337, 289 333 Z"
              fill={bowtie}
            />
            <rect x="239" y="304" width="22" height="24" rx="7" fill={bowtie} />
          </g>

          <g className="rig-eyes-group">
            {state === 'happy' ? (
              <g fill="none" stroke={eyes} strokeWidth="18" strokeLinecap="round">
                <path d="M 190 220 C 198 194, 220 194, 228 220" />
                <path d="M 272 220 C 280 194, 302 194, 310 220" />
              </g>
            ) : (
              <>
                <g className="rig-eye-left">
                  <rect x="195" y="176" width="28" height="71" rx="14" fill={eyes} />
                </g>
                <g className="rig-eye-right">
                  <rect x="277" y="176" width="28" height="71" rx="14" fill={eyes} />
                </g>
              </>
            )}
          </g>

          <g className="rig-hat">
            <g transform="translate(332, 92) rotate(27.5)">
              <rect x="-42" y="-64" width="84" height="66" rx="22" fill={hat} stroke={hat} strokeWidth="8" />
              <rect x="-33" y="-18" width="66" height="14" rx="2" fill={band} />
              <path d="M -64 -2 Q 0 11 64 -2" fill="none" stroke={hat} strokeWidth="15" strokeLinecap="round" />
            </g>
          </g>
        </g>
      </svg>

      {showWordmark && (
        <span className="font-bold text-[22px] tracking-[-0.04em] text-[#0a0a0a] dark:text-[#f5f5f5] leading-none">
          vito
        </span>
      )}
    </div>
  );
};
