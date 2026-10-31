import React, { forwardRef } from 'react';
import { clsx } from 'clsx';

export interface M3ProgressRingProps extends React.SVGAttributes<SVGSVGElement> {
  value: number; // 0 a 100
  size?: number; // diâmetro em pixels (default: 48)
  strokeWidth?: number; // espessura do anel (default: 4)
  color?: string; // Cor CSS do progresso (default: 'var(--acc)')
  trackColor?: string; // Cor do trilho de fundo (default: 'var(--line)')
  showLabel?: boolean;
}

export const M3ProgressRing = forwardRef<SVGSVGElement, M3ProgressRingProps>(
  (
    {
      value,
      size = 48,
      strokeWidth = 4,
      color = 'var(--acc)',
      trackColor = 'var(--line)',
      showLabel = false,
      className,
      ...props
    },
    ref
  ) => {
    const clampedValue = Math.min(100, Math.max(0, value));
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (clampedValue / 100) * circumference;

    return (
      <div
        className={clsx('relative inline-flex items-center justify-center shrink-0', className)}
        style={{ width: size, height: size }}
      >
        <svg
          ref={ref}
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
          {...props}
        >
          {/* Trilho de Fundo */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
            opacity={0.35}
          />
          {/* Anel de Progresso Ativo */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>
        {showLabel && (
          <span className="absolute text-xs font-bold font-variant-numeric tabular-nums text-[var(--ink)]">
            {Math.round(clampedValue)}%
          </span>
        )}
      </div>
    );
  }
);

M3ProgressRing.displayName = 'M3ProgressRing';
