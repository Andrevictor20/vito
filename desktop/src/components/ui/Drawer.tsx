import React, { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';
import { Button } from './Button';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  width?: number | string; // Default: 440px canônico (.dr em Vito Desktop.html)
  showBackdrop?: boolean;
}

/**
 * Drawer - Slide-over panel lateral de 440px fixo à direita para master-detail e relatórios
 * Fiel à classe .dr de Vito Desktop.html com animação suave e dismiss via tecla ESC
 */
export const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 440,
  showBackdrop = true,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Fecha ao pressionar ESC
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Previne scroll do body quando aberto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      {showBackdrop && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-[1px] transition-opacity animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* Slide-over Panel (440px) */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        style={{ width: typeof width === 'number' ? `${width}px` : width }}
        className={clsx(
          'relative h-full bg-[var(--bg)] text-[var(--ink)] border-l border-[var(--line)] shadow-[var(--sh)]',
          'flex flex-col overflow-hidden z-10',
          'animate-in slide-in-from-right duration-200 ease-out'
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[var(--line)] shrink-0">
          <div className="flex-1 min-w-0">
            {title && (
              typeof title === 'string' ? (
                <h2 className="text-lg font-bold truncate m-0 text-[var(--ink)]">{title}</h2>
              ) : (
                title
              )
            )}
            {subtitle && (
              <p className="text-xs text-[var(--muted)] m-0 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          <Button
            variant="gh"
            size="sm"
            pill={false}
            onClick={onClose}
            aria-label="Fechar painel"
            className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)]"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
};
