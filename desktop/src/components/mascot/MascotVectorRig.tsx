import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import {
  MascotAnimationState,
  MascotPart,
  MascotSkin,
  normalizeMascotState,
  resolveSkin,
} from './mascotPalettes';
import './mascotAnimations.css';

export interface MascotVectorRigProps {
  skin?: MascotSkin;
  state?: MascotAnimationState | 'success';
  size?: number;
  animated?: boolean;
  speed?: number;
  darkStage?: boolean;
  isNotification?: boolean;
  reaction?: MascotPart | null;
  interactiveParts?: boolean;
  className?: string;
  onClick?: () => void;
  onPartClick?: (part: MascotPart) => void;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const MascotVectorRig: React.FC<MascotVectorRigProps> = ({
  skin,
  state = 'idle',
  size = 60,
  animated = true,
  speed = 1,
  darkStage,
  isNotification = false,
  reaction = null,
  interactiveParts = false,
  className = '',
  onClick,
  onPartClick,
}) => {
  const { isDark } = useTheme();
  const resolvedState = normalizeMascotState(state);
  const c = resolveSkin(skin, darkStage ?? isDark);
  const isCompact = size <= 34;

  const [localReaction, setLocalReaction] = useState<MascotPart | null>(null);
  const [reduceMotion, setReduceMotion] = useState<boolean>(prefersReducedMotion);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduceMotion(mq.matches);
    onChange();
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    return () => {
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    };
  }, []);

  // Damped 60fps cursor tracking for 'interactive' state
  useEffect(() => {
    if (resolvedState !== 'interactive' || !animated || reduceMotion) return;
    let rafId = 0;
    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;

    const handleMove = (e: PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetX = Math.max(-1.2, Math.min(1.2, nx));
      targetY = Math.max(-1.2, Math.min(1.2, ny));
    };

    const handleLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerleave', handleLeave);

    const tick = () => {
      curX += (targetX - curX) * 0.14;
      curY += (targetY - curY) * 0.14;
      const svg = svgRef.current;
      if (svg) {
        const eyes = svg.querySelector<SVGGElement>('.rig-eyes-group');
        const whole = svg.querySelector<SVGGElement>('.rig-whole');
        const hat = svg.querySelector<SVGGElement>('.rig-hat');
        const bowtie = svg.querySelector<SVGGElement>('.rig-bowtie');
        if (eyes) eyes.style.transform = `translate3d(${(curX * 16).toFixed(2)}px, ${(curY * 12).toFixed(2)}px, 0)`;
        if (whole) whole.style.transform = `translate3d(${(curX * 6).toFixed(2)}px, ${(curY * 4).toFixed(2)}px, 0) rotate(${(curX * 2.5).toFixed(2)}deg)`;
        if (hat) hat.style.transform = `translate3d(${(curX * -4).toFixed(2)}px, ${(curY * -3).toFixed(2)}px, 0) rotate(${(curX * 4).toFixed(2)}deg)`;
        if (bowtie) bowtie.style.transform = `translate3d(${(curX * 6).toFixed(2)}px, ${(curY * 3).toFixed(2)}px, 0)`;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerleave', handleLeave);
    };
  }, [resolvedState, animated, reduceMotion]);

  const activeReaction = reaction ?? localReaction;

  const triggerPart = (e: React.MouseEvent, part: MascotPart) => {
    if (interactiveParts) {
      e.stopPropagation();
      if (!reduceMotion) {
        if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
        setLocalReaction(part);
        reactionTimerRef.current = setTimeout(
          () => setLocalReaction(null),
          part === 'eyes' ? 180 : 580
        );
      }
    }
    onPartClick?.(part);
  };

  const pauseAnimations = !animated || reduceMotion;
  const reactClass = activeReaction ? `mascot-react-${activeReaction}` : '';
  const rootClasses = [
    'mascot-svg shrink-0 select-none',
    `state-${resolvedState}`,
    pauseAnimations ? 'mascot-paused' : '',
    isCompact ? 'mascot-compact' : '',
    reactClass,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 500 500"
      width={size}
      height={size}
      shapeRendering="geometricPrecision"
      className={rootClasses}
      style={{ '--anim-speed': String(speed) } as React.CSSProperties}
      data-anim-state={resolvedState}
      data-compact={isCompact ? 'true' : 'false'}
      data-paused={pauseAnimations ? 'true' : 'false'}
      onClick={onClick}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={onClick ? undefined : true}
    >
      <g className="rig-whole">
        {!isCompact && (
          <>
            <g className="fx-sparkles" stroke={c.bowtie} strokeWidth="10" strokeLinecap="round" fill="none">
              <path d="M 74 140 L 74 176 M 56 158 L 92 158" />
              <path d="M 432 168 L 432 198 M 417 183 L 447 183" />
              <circle cx="105" cy="96" r="6" fill={c.bowtie} stroke="none" />
              <circle cx="410" cy="238" r="6" fill={c.bowtie} stroke="none" />
            </g>

            <g className="fx-alert" stroke={c.bowtie} strokeWidth="12" strokeLinecap="round">
              <line x1="115" y1="88" x2="90" y2="62" />
              <line x1="168" y1="54" x2="155" y2="22" />
              <line x1="88" y1="142" x2="54" y2="132" />
            </g>

            <g className="fx-thinking" fill={c.fill} stroke={c.stroke} strokeWidth="10">
              <circle className="fx-dot-1" cx="404" cy="148" r="10" />
              <circle className="fx-dot-2" cx="432" cy="112" r="15" />
              <circle className="fx-dot-3" cx="456" cy="66" r="21" />
            </g>

            <g className="fx-zzz" fill="none" stroke={c.stroke} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
              <path className="fx-z-1" d="M 386 150 H 414 L 386 180 H 414" />
              <path className="fx-z-2" d="M 412 115 H 444 L 412 149 H 444" />
              <path className="fx-z-3" d="M 436 80 H 472 L 436 118 H 472" />
            </g>
          </>
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

        <g
          className="rig-bowtie"
          onClick={interactiveParts ? (e) => triggerPart(e, 'bowtie') : undefined}
          style={interactiveParts ? { cursor: 'pointer' } : undefined}
        >
          <path d="M 211 299 C 211 295, 215 293, 219 295 L 244 307 L 244 325 L 219 337 C 215 339, 211 337, 211 333 Z" fill={c.bowtie} />
          <path d="M 289 299 C 289 295, 285 293, 281 295 L 256 307 L 256 325 L 281 337 C 285 339, 289 337, 289 333 Z" fill={c.bowtie} />
          <rect x="239" y="304" width="22" height="24" rx="7" fill={c.bowtie} />
        </g>

        <g
          className="rig-eyes-group"
          onClick={interactiveParts ? (e) => triggerPart(e, 'eyes') : undefined}
          style={interactiveParts ? { cursor: 'pointer' } : undefined}
        >
          <g className="eyes-default">
            <g className="rig-eye-left">
              <rect x="195" y="176" width="28" height="71" rx="14" fill={c.eyes} />
            </g>
            <g className="rig-eye-right">
              <rect x="277" y="176" width="28" height="71" rx="14" fill={c.eyes} />
            </g>
          </g>
          <g className="eyes-happy" fill="none" stroke={c.eyes} strokeWidth="18" strokeLinecap="round">
            <path d="M 190 220 C 198 194, 220 194, 228 220" />
            <path d="M 272 220 C 280 194, 302 194, 310 220" />
          </g>
          <g className="eyes-sleeping" fill="none" stroke={c.eyes} strokeWidth="16" strokeLinecap="round">
            <path d="M 190 214 C 198 232, 220 232, 228 214" />
            <path d="M 272 214 C 280 232, 302 232, 310 214" />
          </g>
        </g>

        <g
          className="rig-hat"
          onClick={interactiveParts ? (e) => triggerPart(e, 'hat') : undefined}
          style={interactiveParts ? { cursor: 'pointer' } : undefined}
        >
          <g transform="translate(332, 92) rotate(27.5)">
            {isNotification ? (
              <rect x="-32" y="-12" width="64" height="14" rx="3" fill={c.band} />
            ) : (
              <>
                <rect x="-42" y="-64" width="84" height="66" rx="22" fill={c.hat} stroke={c.hat} strokeWidth="8" />
                <rect x="-33" y="-18" width="66" height="14" rx="2" fill={c.band} />
                <path d="M -64 -2 Q 0 11 64 -2" fill="none" stroke={c.hat} strokeWidth="15" strokeLinecap="round" />
              </>
            )}
          </g>
        </g>
      </g>
    </svg>
  );
};
