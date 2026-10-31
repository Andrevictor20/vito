import React, { forwardRef, useId } from 'react';
import { clsx } from 'clsx';

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  tabularNums?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      label,
      helperText,
      errorMessage,
      leftIcon,
      rightIcon,
      tabularNums = false,
      id,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = errorMessage ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-[var(--muted)] select-none"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {leftIcon && (
            <span className="absolute left-3 text-[var(--muted)] pointer-events-none inline-flex items-center">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={errorId || helperId}
            className={clsx(
              'w-full bg-[var(--surf)] text-[var(--ink)] border border-[var(--line)] rounded-xl py-2 px-3 text-sm transition-all',
              'placeholder:text-[var(--muted)] placeholder:opacity-75',
              'focus-visible:outline-2 focus-visible:outline-[var(--blue)] focus-visible:outline-offset-2 focus:border-[var(--blue)]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              tabularNums && 'font-variant-numeric tabular-nums',
              leftIcon ? 'pl-9' : 'pl-3',
              rightIcon ? 'pr-9' : 'pr-3',
              errorMessage && 'border-[var(--red)] focus:border-[var(--red)] focus-visible:outline-[var(--red)]',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 text-[var(--muted)] pointer-events-none inline-flex items-center">
              {rightIcon}
            </span>
          )}
        </div>
        {errorMessage ? (
          <span id={errorId} className="text-xs font-medium text-[var(--red)]">
            {errorMessage}
          </span>
        ) : helperText ? (
          <span id={helperId} className="text-xs text-[var(--muted)]">
            {helperText}
          </span>
        ) : null}
      </div>
    );
  }
);

TextInput.displayName = 'TextInput';
