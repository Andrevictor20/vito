import React, { forwardRef } from 'react';
import { clsx } from 'clsx';

export type ChipColor = 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'teal' | 'neutral';

export interface SelectableChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  color?: ChipColor;
  icon?: React.ReactNode;
}

export const SelectableChip = forwardRef<HTMLButtonElement, SelectableChipProps>(
  (
    {
      active = false,
      color = 'neutral',
      icon,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={active}
        disabled={disabled}
        className={clsx(
          'inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border transition-all select-none',
          'focus-visible:outline-2 focus-visible:outline-[var(--blue)] focus-visible:outline-offset-2 active:scale-[0.97]',
          'disabled:opacity-50 disabled:pointer-events-none',
          !active && 'bg-[var(--bg)] text-[var(--muted)] border-[var(--line)] hover:bg-[var(--surf)] hover:text-[var(--ink)]',
          // Estados Ativos Tonais
          active && color === 'neutral' && 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]',
          active && color === 'blue' && 'bg-[var(--blue-bg)] text-[var(--blue)] border-[var(--blue)]',
          active && color === 'green' && 'bg-[var(--green-bg)] text-[var(--acc)] border-[var(--acc)]',
          active && color === 'red' && 'bg-[var(--red-bg)] text-[var(--red)] border-[var(--red)]',
          active && color === 'purple' && 'bg-[var(--purple-bg)] text-[var(--purple)] border-[var(--purple)]',
          active && color === 'orange' && 'bg-[var(--orange-bg)] text-[var(--orange)] border-[var(--orange)]',
          active && color === 'teal' && 'bg-[var(--teal-bg)] text-[var(--teal)] border-[var(--teal)]',
          className
        )}
        {...props}
      >
        {icon && <span className="inline-flex shrink-0">{icon}</span>}
        <span>{children}</span>
      </button>
    );
  }
);

SelectableChip.displayName = 'SelectableChip';
