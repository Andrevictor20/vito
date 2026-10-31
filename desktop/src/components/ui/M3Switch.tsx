import { forwardRef } from 'react';
import { clsx } from 'clsx';
import { Check, X } from 'lucide-react';

export interface M3SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  showIcons?: boolean;
  id?: string;
  name?: string;
  'aria-label'?: string;
  className?: string;
}

/**
 * M3Switch - Switch aderente à especificação Material Design 3 (52x32px com thumb dinâmico)
 */
export const M3Switch = forwardRef<HTMLButtonElement, M3SwitchProps>(
  (
    {
      checked,
      onChange,
      disabled = false,
      showIcons = false,
      id,
      name,
      'aria-label': ariaLabel = 'Alternar',
      className,
    },
    ref
  ) => {
    const handleToggle = () => {
      if (!disabled) {
        onChange(!checked);
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
        className={clsx(
          'relative inline-flex items-center h-[32px] w-[52px] shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out',
          'focus-visible:outline-2 focus-visible:outline-[var(--blue)] focus-visible:outline-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          checked
            ? 'bg-[var(--ink)] border-[var(--ink)]'
            : 'bg-[var(--surf)] border-[var(--line)]',
          className
        )}
      >
        <span
          className={clsx(
            'pointer-events-none flex items-center justify-center rounded-full transition-all duration-200 ease-in-out shadow-sm',
            checked
              ? 'translate-x-[24px] w-[24px] h-[24px] bg-[var(--bg)] text-[var(--ink)]'
              : 'translate-x-[4px] w-[16px] h-[16px] bg-[var(--muted)] text-[var(--bg)]'
          )}
        >
          {showIcons && checked && <Check className="w-3 h-3 stroke-[3]" />}
          {showIcons && !checked && <X className="w-2.5 h-2.5 stroke-[3]" />}
        </span>
      </button>
    );
  }
);

M3Switch.displayName = 'M3Switch';
