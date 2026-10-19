import React, { useState, useEffect } from 'react';
import { DesktopTab } from './Sidebar';
import {
  Search,
  Calendar,
  CheckSquare,
  Radar,
  CalendarCheck,
  User,
  Sparkles,
  LogOut,
} from 'lucide-react';

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
      label: 'Ir para Início & Chat',
      category: 'Navegação',
      icon: Sparkles,
      run: () => onSelectTab('chat'),
    },
    {
      id: 'tab-calendar',
      label: 'Ir para Agenda & Eventos',
      category: 'Navegação',
      icon: Calendar,
      run: () => onSelectTab('calendar'),
    },
    {
      id: 'tab-tasks',
      label: 'Ir para Tarefas & Foco',
      category: 'Navegação',
      icon: CheckSquare,
      run: () => onSelectTab('tasks'),
    },
    {
      id: 'tab-triggers',
      label: 'Ir para Vigílias & Radares',
      category: 'Navegação',
      icon: Radar,
      run: () => onSelectTab('triggers'),
    },
    {
      id: 'tab-meetings',
      label: 'Ir para Reuniões & Booking',
      category: 'Navegação',
      icon: CalendarCheck,
      run: () => onSelectTab('meetings'),
    },
    {
      id: 'tab-profile',
      label: 'Abrir Configurações (⌘,)',
      category: 'Conta',
      icon: User,
      run: () => (onOpenSettings ? onOpenSettings() : undefined),
    },
    {
      id: 'toggle-ai',
      label: 'Abrir / Fechar Assistente Vito (⌘J)',
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

  const filtered = actions.filter((a) =>
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
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/60 backdrop-blur-sm select-none">
      <div className="w-full max-w-xl bg-[#14171C] border border-white/10 rounded-2xl shadow-modal overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-white/10 gap-3">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite um comando, navegação ou pesquisa..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
          />
          <kbd className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-slate-400">
            Esc
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Nenhum comando encontrado para "{query}"
            </div>
          ) : (
            filtered.map((action, i) => {
              const Icon = action.icon;
              const isSelected = i === selectedIndex;
              return (
                <button
                  key={action.id}
                  onClick={() => {
                    action.run();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-colors ${
                    isSelected ? 'bg-indigo-600/20 text-white border border-indigo-500/30' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} className={isSelected ? 'text-indigo-400' : 'text-slate-400'} />
                    <span>{action.label}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium px-2 py-0.5 rounded bg-white/5">
                    {action.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2 border-t border-white/5 bg-[#0B0D10]/50 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ navegar</span>
            <span>↵ selecionar</span>
          </div>
          <span>Vito Desktop v0.1</span>
        </div>
      </div>
    </div>
  );
};
