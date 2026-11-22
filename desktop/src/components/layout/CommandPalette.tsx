import React, { useEffect, useState } from 'react';
import {
  Bell,
  Bot,
  Calendar,
  CalendarCheck,
  CheckSquare,
  LogOut,
  Search,
  Sparkles,
  User,
  Wallet,
} from 'lucide-react';
import type { DesktopTab } from './Sidebar';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelectTab: (tab: DesktopTab) => void;
  onToggleAIPanel: () => void;
  onLogout: () => void;
  onOpenSettings?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  onSelectTab,
  onToggleAIPanel,
  onLogout,
  onOpenSettings,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const actions = [
    {
      id: 'tab-chat',
      label: 'Ir para Vito (Conversas)',
      category: 'Navegação',
      icon: Sparkles,
      run: () => onSelectTab('chat'),
    },
    {
      id: 'tab-calendar',
      label: 'Ir para Agenda',
      category: 'Navegação',
      icon: Calendar,
      run: () => onSelectTab('calendar'),
    },
    {
      id: 'tab-tasks',
      label: 'Ir para Tarefas',
      category: 'Navegação',
      icon: CheckSquare,
      run: () => onSelectTab('tasks'),
    },
    {
      id: 'tab-finance',
      label: 'Ir para Finanças',
      category: 'Navegação',
      icon: Wallet,
      run: () => onSelectTab('finance'),
    },
    {
      id: 'tab-triggers',
      label: 'Ir para Bots',
      category: 'Navegação',
      icon: Bot,
      run: () => onSelectTab('triggers'),
    },
    {
      id: 'tab-meetings',
      label: 'Abrir Agendamentos (Booking)',
      category: 'Agenda',
      icon: CalendarCheck,
      run: () => onSelectTab('meetings'),
    },
    {
      id: 'tab-notifs',
      label: 'Abrir Notificações',
      category: 'Conversas',
      icon: Bell,
      run: () => onSelectTab('notifications'),
    },
    {
      id: 'tab-profile',
      label: 'Abrir Perfil & Configurações (⌘,)',
      category: 'Conta',
      icon: User,
      run: () => (onOpenSettings ? onOpenSettings() : onSelectTab('settings')),
    },
    {
      id: 'toggle-ai',
      label: 'Abrir Assistente Vito',
      category: 'Assistente',
      icon: Sparkles,
      run: onToggleAIPanel,
    },
    {
      id: 'action-logout',
      label: 'Encerrar Sessão',
      category: 'Conta',
      icon: LogOut,
      run: onLogout,
    },
  ];

  const filtered = actions.filter(
    (a) =>
      a.label.toLowerCase().includes(query.toLowerCase()) ||
      a.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (filtered.length ? (prev + 1) % filtered.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filtered.length ? (prev - 1 + filtered.length) % filtered.length : 0
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].run();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filtered, selectedIndex, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/50 backdrop-blur-sm select-none">
      <div className="w-full max-w-xl bg-[var(--bg)] border border-[var(--line)] rounded-[28px] shadow-[var(--shadow)] overflow-hidden tr-tab">
        <div className="flex items-center px-5 py-3.5 border-b border-[var(--line)] gap-3">
          <Search size={18} className="text-[var(--muted)] shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite um comando, navegação ou pesquisa..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none"
          />
          <kbd className="px-2.5 py-0.5 rounded-full bg-[var(--surf)] border border-[var(--line)] text-[10px] font-mono text-[var(--muted)]">
            Esc
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-[var(--muted)]">
              Nenhum comando encontrado para "{query}"
            </div>
          ) : (
            filtered.map((action, i) => {
              const Icon = action.icon;
              const isSelected = i === selectedIndex;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    action.run();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`v5-press w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs transition-colors ${
                    isSelected
                      ? 'bg-[var(--ink)] text-[var(--bg)]'
                      : 'text-[var(--ink)] hover:bg-[var(--surf)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      size={16}
                      className={isSelected ? 'text-[var(--bg)]' : 'text-[var(--muted)]'}
                    />
                    <span className="font-medium">{action.label}</span>
                  </div>
                  <span
                    className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full ${
                      isSelected
                        ? 'bg-white/15 text-[var(--bg)]'
                        : 'bg-[var(--surf)] text-[var(--muted)]'
                    }`}
                  >
                    {action.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="px-5 py-2.5 border-t border-[var(--line)] bg-[var(--surf)] flex items-center justify-between text-[11px] text-[var(--muted)] font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ navegar</span>
            <span>↵ selecionar</span>
          </div>
          <span>Vito Desktop v5</span>
        </div>
      </div>
    </div>
  );
};
