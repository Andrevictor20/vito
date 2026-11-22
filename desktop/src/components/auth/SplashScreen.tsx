import React, { useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { loginPalette } from './loginPalette';
import { VitoAnimatedLogo } from './VitoAnimatedLogo';

export interface SplashScreenProps {
  onFinish?: () => void;
  autoDismiss?: boolean;
  durationMs?: number;
}

/**
 * Splash v5 (#vsplash) Desktop:
 * - Superficie --bg (#ffffff Light / #0a0a0a Dark)
 * - VitoMascot state="gentleman" (140x140, 1.5x speed)
 * - Wordmark "Vito" 46px entrada blur-to-sharp
 * - Barra de progresso indeterminada (46x3px)
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  autoDismiss = false,
  durationMs = 2100,
}) => {
  const { isDark } = useTheme();
  const palette = loginPalette(isDark);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!autoDismiss || !onFinish) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      onFinish();
      return;
    }

    const fadeTimer = setTimeout(() => setLeaving(true), Math.max(800, durationMs - 450));
    const endTimer = setTimeout(() => onFinish(), durationMs);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(endTimer);
    };
  }, [autoDismiss, durationMs, onFinish]);

  return (
    <div
      id="vsplash"
      role="status"
      aria-label="Iniciando Vito"
      style={{ backgroundColor: palette.bg, color: palette.ink }}
      className={`fixed inset-0 z-50 flex items-center justify-center select-none transition-all duration-500 ${
        leaving ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      <style>{`
        @keyframes splPop {
          from { opacity: 0; transform: translateY(16px) scale(0.7); }
          to { opacity: 1; transform: none; }
        }
        @keyframes splIn {
          from { opacity: 0; transform: scale(0.88); filter: blur(10px); }
          to { opacity: 1; transform: none; filter: blur(0px); }
        }
        @keyframes splBar {
          from { transform: translateX(-100%); }
          to { transform: translateX(200%); }
        }
        .spl-mascot-enter {
          animation: splPop 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .spl-word-enter {
          animation: splIn 0.8s 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .spl-bar-wrap {
          animation: splIn 0.8s 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .spl-bar-fill {
          animation: splBar 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .spl-mascot-enter, .spl-word-enter, .spl-bar-wrap, .spl-bar-fill {
            animation: none !important;
          }
        }
      `}</style>

      <div className="flex flex-col items-center text-center">
        <div className="w-[140px] h-[140px] mb-1 flex items-center justify-center spl-mascot-enter">
          <VitoAnimatedLogo size={140} showWordmark={false} state="gentleman" speed={1.5} />
        </div>

        <b className="block font-medium text-[46px] leading-none tracking-[-0.045em] spl-word-enter">
          Vito
        </b>

        <div
          style={{ backgroundColor: palette.line }}
          className="relative w-[46px] h-[3px] rounded-[2px] mt-5 overflow-hidden spl-bar-wrap"
        >
          <span
            style={{ backgroundColor: palette.ink }}
            className="absolute inset-y-0 left-0 w-1/2 rounded-[2px] spl-bar-fill"
          />
        </div>
      </div>
    </div>
  );
};
