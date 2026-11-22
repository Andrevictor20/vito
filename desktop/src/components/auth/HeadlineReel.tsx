import React, { useEffect, useRef, useState } from 'react';
import { DEMO_HEADLINES, DEMO_SCENES, getToneColor } from './demoScenes';
import { useTheme } from '../../context/ThemeContext';

interface HeadlineReelProps {
  currentIndex?: number;
  currentHeadline?: string;
}

export const HeadlineReel: React.FC<HeadlineReelProps> = ({
  currentIndex = 0,
  currentHeadline,
}) => {
  const { isDark } = useTheme();
  const headline = currentHeadline || DEMO_SCENES[currentIndex]?.headline || DEMO_HEADLINES[0];
  const [items, setItems] = useState<string[]>([headline]);
  const [animating, setAnimating] = useState(false);
  const previousRef = useRef(headline);
  const stripRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (headline === previousRef.current || reduce) {
      setItems([headline]);
      previousRef.current = headline;
      return;
    }

    const pool = DEMO_HEADLINES.filter((h) => h !== headline && h !== previousRef.current);
    const fillers: string[] = [];
    while (fillers.length < 3 && pool.length > 0) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (!fillers.includes(pick)) fillers.push(pick);
    }
    const sequence = [headline, ...fillers, previousRef.current];
    setItems(sequence);
    setAnimating(true);

    const strip = stripRef.current;
    if (strip) {
      strip.style.transition = 'none';
      strip.style.transform = `translateY(-${(sequence.length - 1) * 1.25}em)`;
      void strip.offsetHeight;
      strip.style.transition = 'transform 0.95s cubic-bezier(0.22, 1, 0.36, 1)';
      strip.style.transform = 'translateY(0)';
    }

    const timer = setTimeout(() => {
      setItems([headline]);
      if (strip) {
        strip.style.transition = 'none';
        strip.style.transform = 'none';
      }
      setAnimating(false);
      previousRef.current = headline;
    }, 1020);

    return () => clearTimeout(timer);
  }, [headline]);

  return (
    <span className="lg-reel block h-[1.25em] overflow-hidden whitespace-nowrap align-bottom select-none">
      <span ref={stripRef} id="lg-strip" className="block will-change-transform">
        {items.map((text, idx) => {
          const isFiller = animating && idx > 0 && idx < items.length - 1;
          const scene = DEMO_SCENES.find((s) => s.headline === text);
          const color = scene ? getToneColor(scene.tone, isDark) : undefined;

          return (
            <span
              key={`${text}-${idx}`}
              style={{ color }}
              className={`block h-[1.25em] leading-[1.25em] font-bold tracking-[-0.035em] transition-opacity duration-300 ${
                isFiller ? 'opacity-45 scale-y-110 blur-[1.5px]' : 'opacity-100'
              }`}
            >
              {text}
            </span>
          );
        })}
      </span>
    </span>
  );
};
