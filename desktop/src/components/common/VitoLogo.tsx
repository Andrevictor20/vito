import React from 'react';
import { VitoMascot } from './VitoMascot';

export interface VitoLogoProps {
  size?: 'small' | 'medium' | 'large';
  showWordmark?: boolean;
  showDot?: boolean;
  className?: string;
}

export const VitoLogo: React.FC<VitoLogoProps> = ({
  size = 'medium',
  showWordmark = true,
  showDot = true,
  className = '',
}) => {
  const dimensions = {
    small: { mascot: 26, font: 'text-lg', dot: 'w-1.5 h-1.5' },
    medium: { mascot: 36, font: 'text-2xl', dot: 'w-2 h-2' },
    large: { mascot: 52, font: 'text-4xl', dot: 'w-2.5 h-2.5' },
  }[size];

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <VitoMascot size={dimensions.mascot} />
      {showWordmark && (
        <div className="flex items-baseline gap-1">
          <span className={`font-extrabold tracking-[-0.04em] text-zinc-900 dark:text-white ${dimensions.font} lowercase leading-none`}>
            vito
          </span>
          {showDot && (
            <span
              className={`${dimensions.dot} rounded-full bg-[#10B981] inline-block shadow-[0_0_8px_#10B981] animate-pulse`}
              title="Online"
            />
          )}
        </div>
      )}
    </div>
  );
};
