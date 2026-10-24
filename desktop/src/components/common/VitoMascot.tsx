import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useTheme } from '../../context/ThemeContext';

export interface VitoMascotProps {
  size?: number;
  animated?: boolean;
  state?: 'idle' | 'thinking' | 'success';
  className?: string;
  onClick?: () => void;
}

// Geometria medida no canvas 512x512 do mascot.png original (idêntico ao mobile).
const EYE_WIDTH_RATIO = 29 / 512;
const EYE_HEIGHT_RATIO = 71 / 512;
const EYE_CENTER_Y_RATIO = 216.5 / 512;
const EYE_LEFT_CENTER_X_RATIO = 214.5 / 512;
const EYE_RIGHT_CENTER_X_RATIO = 297.5 / 512;

type Gaze = { x: number; y: number };

const IDLE_TARGETS: Gaze[] = [
  { x: 0, y: 0 },
  { x: 0.8, y: 0.1 },
  { x: -0.8, y: 0.1 },
  { x: 0.5, y: -0.4 },
  { x: -0.5, y: -0.4 },
  { x: 0, y: 0.35 },
];

const THINKING_TARGETS: Gaze[] = [
  { x: 0.9, y: -0.9 },
  { x: -0.7, y: -1 },
  { x: 0.2, y: -1 },
];

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);

export const VitoMascot: React.FC<VitoMascotProps> = ({
  size = 48,
  animated = true,
  state = 'idle',
  className = '',
  onClick,
}) => {
  const { isDark } = useTheme();

  const [gaze, setGaze] = useState<Gaze>({ x: 0, y: 0 });
  const [blinkScale, setBlinkScale] = useState(1);
  const [transitionDuration, setTransitionDuration] = useState(180);

  const aliveRef = useRef(true);
  const blinkTimerRef = useRef<any>(null);
  const gazeTimerRef = useRef<any>(null);
  const lastGazeRef = useRef<Gaze>({ x: 0, y: 0 });

  // Ciclo de Piscar Orgânico (2.8s - 6s, com piscada dupla ocasional)
  const triggerBlink = useCallback((doubleBlink = false) => {
    if (!aliveRef.current) return;
    setBlinkScale(0.08);

    setTimeout(() => {
      if (!aliveRef.current) return;
      setBlinkScale(1);

      if (doubleBlink) {
        setTimeout(() => {
          if (!aliveRef.current) return;
          setBlinkScale(0.08);
          setTimeout(() => {
            if (!aliveRef.current) return;
            setBlinkScale(1);
          }, 80);
        }, 110);
      }
    }, 90);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    if (!animated) return;

    const scheduleNextBlink = () => {
      const delay = randomBetween(2800, 6000);
      blinkTimerRef.current = setTimeout(() => {
        if (!aliveRef.current) return;
        const isDouble = Math.random() < 0.22;
        triggerBlink(isDouble);
        scheduleNextBlink();
      }, delay);
    };

    scheduleNextBlink();

    return () => {
      aliveRef.current = false;
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    };
  }, [animated, triggerBlink]);

  // Ciclo de Sacadas e Olhares (Saccade + Fixation)
  useEffect(() => {
    aliveRef.current = true;
    if (!animated) return;

    const maxX = size * 0.045;
    const maxY = size * 0.035;

    const scheduleNextGaze = () => {
      const targets = state === 'thinking' ? THINKING_TARGETS : IDLE_TARGETS;
      const holdTime = state === 'thinking' ? randomBetween(700, 1400) : randomBetween(1600, 3800);

      gazeTimerRef.current = setTimeout(() => {
        if (!aliveRef.current) return;

        const candidates = targets.filter(
          (t) => t.x !== lastGazeRef.current.x || t.y !== lastGazeRef.current.y
        );
        const next = candidates[Math.floor(Math.random() * candidates.length)] || targets[0];
        const dist = Math.hypot(next.x - lastGazeRef.current.x, next.y - lastGazeRef.current.y);

        const dur = state === 'thinking' ? 520 : Math.round(180 + dist * 100);
        setTransitionDuration(dur);

        if (dist > 1.1 && Math.random() < 0.35) {
          triggerBlink(false);
        }

        lastGazeRef.current = next;
        setGaze({ x: next.x * maxX, y: next.y * maxY });

        scheduleNextGaze();
      }, holdTime);
    };

    scheduleNextGaze();

    return () => {
      aliveRef.current = false;
      if (gazeTimerRef.current) clearTimeout(gazeTimerRef.current);
    };
  }, [animated, state, size, triggerBlink]);

  // Dimensões exatas dos olhos proporcionais ao tamanho
  const eyeWidth = Math.max(3, Math.round(size * EYE_WIDTH_RATIO));
  const eyeHeight = Math.max(4, Math.round(size * EYE_HEIGHT_RATIO));
  const eyeTop = Math.round(size * EYE_CENTER_Y_RATIO - eyeHeight / 2);
  const leftEyeLeft = Math.round(size * EYE_LEFT_CENTER_X_RATIO - eyeWidth / 2);
  const rightEyeLeft = Math.round(size * EYE_RIGHT_CENTER_X_RATIO - eyeWidth / 2);

  const eyeColor = isDark ? '#A0A6B0' : '#17191b';
  const bodySrc = isDark ? '/assets/mascot-body-dark.png' : '/assets/mascot-body.png';

  return (
    <div
      onClick={onClick}
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center select-none shrink-0 ${className}`}
      data-state={state}
    >
      {/* Corpo do Mascote sem Olhos (o corpo tem recorte transparente para os olhos) */}
      <img
        src={bodySrc}
        alt="Vito Mascote"
        style={{ width: size, height: size }}
        className="w-full h-full object-contain pointer-events-none drop-shadow-sm transition-transform duration-300 hover:scale-105"
      />

      {/* Olho Esquerdo Animado */}
      <div
        style={{
          position: 'absolute',
          top: eyeTop,
          left: leftEyeLeft,
          width: eyeWidth,
          height: eyeHeight,
          borderRadius: Math.round(eyeWidth / 2),
          backgroundColor: eyeColor,
          transform: `translate(${gaze.x}px, ${gaze.y}px) scaleY(${blinkScale})`,
          transition: `transform ${transitionDuration}ms cubic-bezier(0.33, 0, 0.2, 1)`,
          transformOrigin: 'center center',
          pointerEvents: 'none',
        }}
      />

      {/* Olho Direito Animado */}
      <div
        style={{
          position: 'absolute',
          top: eyeTop,
          left: rightEyeLeft,
          width: eyeWidth,
          height: eyeHeight,
          borderRadius: Math.round(eyeWidth / 2),
          backgroundColor: eyeColor,
          transform: `translate(${gaze.x}px, ${gaze.y}px) scaleY(${blinkScale})`,
          transition: `transform ${transitionDuration}ms cubic-bezier(0.33, 0, 0.2, 1)`,
          transformOrigin: 'center center',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};
