import React, { forwardRef } from 'react';
import { clsx } from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'surface' | 'accent';
  accentColor?: 'blue' | 'red' | 'purple' | 'green' | 'orange' | 'teal';
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      padding = 'md',
      variant = 'default',
      accentColor,
      interactive = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const accentBorderColor = accentColor
      ? accentColor === 'blue'
        ? 'var(--blue)'
        : accentColor === 'red'
        ? 'var(--red)'
        : accentColor === 'purple'
        ? 'var(--purple)'
        : accentColor === 'green'
        ? 'var(--acc)'
        : accentColor === 'orange'
        ? 'var(--orange)'
        : 'var(--teal)'
      : undefined;

    return (
      <div
        ref={ref}
        tabIndex={interactive ? 0 : undefined}
        style={accentBorderColor ? ({ '--c': accentBorderColor } as React.CSSProperties) : undefined}
        className={clsx(
          'rounded-2xl border border-[var(--line)] transition-colors',
          'box-border shadow-[0_1px_2px_rgba(20,25,22,0.04)]',
          // Variantes de fundo
          variant === 'default' && 'bg-[var(--bg)] text-[var(--ink)]',
          variant === 'surface' && 'bg-[var(--surf)] text-[var(--ink)]',
          variant === 'accent' && 'bg-[var(--bg)] text-[var(--ink)] border-l-4 border-l-[var(--c,var(--blue))]',
          accentColor && 'border-l-4 border-l-[var(--c,var(--blue))]',
          // Padding
          padding === 'none' && 'p-0',
          padding === 'sm' && 'p-3',
          padding === 'md' && 'p-4',
          padding === 'lg' && 'p-5',
          // Interatividade
          interactive && 'cursor-pointer hover:bg-[var(--surf)] focus-visible:outline-2 focus-visible:outline-[var(--blue)] focus-visible:outline-offset-2',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
