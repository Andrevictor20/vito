import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'pri' | 'gh' | 'outline' | 'sm';
  size?: 'sm' | 'md' | 'lg';
  pill?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'default',
      size = 'md',
      pill = true,
      loading = false,
      leftIcon,
      rightIcon,
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isSm = variant === 'sm' || size === 'sm';

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        className={clsx(
          'inline-flex items-center justify-center gap-2 font-semibold transition-all select-none',
          'focus-visible:outline-2 focus-visible:outline-[var(--blue)] focus-visible:outline-offset-2',
          'active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none',
          pill ? 'rounded-full' : 'rounded-xl',
          // Variantes de tamanho
          isSm ? 'px-2.5 py-1 text-xs' : size === 'lg' ? 'px-5 py-2.5 text-base' : 'px-3.5 py-1.5 text-sm',
          // Variantes visuais canônicas de Vito Desktop.html
          variant === 'pri' && 'bg-[var(--ink)] text-[var(--bg)] border border-[var(--ink)] hover:opacity-90',
          variant === 'gh' && 'bg-transparent text-[var(--ink)] border-0 hover:bg-[var(--surf)]',
          variant === 'outline' && 'bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--surf)]',
          variant === 'sm' && 'bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--surf)]',
          variant === 'default' && 'bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--surf)]',
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!loading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
