import React, { forwardRef } from 'react';
import { clsx } from 'clsx';

export interface VitoSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  name?: string;
  'aria-label'?: string;
  className?: string;
}

/**
 * VitoSwitch - Fiel à classe .sw de Vito Desktop.html (40x22px, thumb 16x16px branco, ativo verde acc)
 */
export const VitoSwitch = forwardRef<HTMLButtonElement, VitoSwitchProps>(
  (
    {
      checked,
      onChange,
      disabled = false,
      id,
      name,
      'aria-label': ariaLabel = 'Alternar configuração',
      className,
    },
    ref
  ) => {
    const handleToggle = () => {
      if (!disabled) {
        onChange(!checked);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        handleToggle();
      }
    };

    return (
      <button
        ref={ref}
        id={id}
        name={name}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={clsx(
          'relative w-[40px] h-[22px] rounded-full p-0 border-0 shrink-0 transition-colors cursor-pointer select-none',
          'focus-visible:outline-2 focus-visible:outline-[var(--blue)] focus-visible:outline-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          checked ? 'bg-[var(--acc)]' : 'bg-[var(--line)]',
          className
        )}
      >
        <span
          className={clsx(
            'absolute top-[3px] w-[16px] h-[16px] rounded-full bg-white transition-all shadow-sm pointer-events-none',
            checked ? 'left-[21px]' : 'left-[3px]'
          )}
        />
      </button>
    );
  }
);

VitoSwitch.displayName = 'VitoSwitch';
