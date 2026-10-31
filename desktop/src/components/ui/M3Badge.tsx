import React, { forwardRef } from 'react';
import { clsx } from 'clsx';

export type BadgeTone = 'b' | 'g' | 'r' | 'p' | 'o' | 't' | 'neutral';

export interface M3BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

/**
 * M3Badge - Fiel à classe .tag e classes de cor (.b, .g, .r, .p, .o, .t) de Vito Desktop.html
 */
export const M3Badge = forwardRef<HTMLSpanElement, M3BadgeProps>(
  (
    {
      tone = 'neutral',
      size = 'sm',
      pulse = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={clsx(
          'inline-flex items-center gap-1.5 font-bold rounded-full select-none leading-none',
          size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs',
          // Tons semânticos fiéis a Vito Desktop.html
          tone === 'neutral' && 'bg-[var(--surf)] text-[var(--ink)]',
          tone === 'b' && 'bg-[var(--blue-bg)] text-[var(--blue)]',
          tone === 'g' && 'bg-[var(--green-bg)] text-[var(--acc)]',
          tone === 'r' && 'bg-[var(--red-bg)] text-[var(--red)]',
          tone === 'p' && 'bg-[var(--purple-bg)] text-[var(--purple)]',
          tone === 'o' && 'bg-[var(--orange-bg)] text-[var(--orange)]',
          tone === 't' && 'bg-[var(--teal-bg)] text-[var(--teal)]',
          className
        )}
        {...props}
      >
        {pulse && (
          <span
            className={clsx(
              'w-2 h-2 rounded-full inline-block animate-pulse',
              tone === 'r' ? 'bg-[var(--red)]' : tone === 'g' ? 'bg-[var(--acc)]' : 'bg-current'
            )}
            aria-hidden="true"
          />
        )}
        <span>{children}</span>
      </span>
    );
  }
);

M3Badge.displayName = 'M3Badge';
