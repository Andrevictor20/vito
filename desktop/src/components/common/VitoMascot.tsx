import React from 'react';
import { useTheme } from '../../context/ThemeContext';

export interface VitoMascotProps {
  size?: number;
  state?: 'idle' | 'thinking' | 'success';
  className?: string;
}

export const VitoMascot: React.FC<VitoMascotProps> = ({
  size = 38,
  state = 'idle',
  className = '',
}) => {
  const { isDark } = useTheme();

  return (
    <div
      style={{ width: size, height: size }}
      data-state={state}
      className={`relative inline-flex items-center justify-center select-none ${className}`}
    >
      <img
        src={isDark ? '/assets/mascot-dark.png' : '/assets/mascot.png'}
        alt="Vito Mascot"
        style={{ width: size, height: size }}
        className="object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] transition-transform duration-300 hover:scale-105"
        onError={(e) => {
          // Fallback gracioso caso assets ainda estejam em carregamento
          (e.target as HTMLImageElement).src = '/assets/mascot.png';
        }}
      />
    </div>
  );
};
