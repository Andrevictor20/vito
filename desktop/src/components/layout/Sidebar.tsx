import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  MessageSquare,
  Calendar,
  CheckSquare,
  Radar,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  BarChart3,
  Settings,
  Search,
} from 'lucide-react';
import { VitoMascot } from '../common/VitoMascot';

export type DesktopTab =
  | 'chat'
  | 'calendar'
  | 'tasks'
  | 'triggers'
  | 'meetings'
  | 'summaries'
  | 'settings';

interface SidebarProps {
  currentTab: DesktopTab;
  onSelectTab: (tab: DesktopTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenCommandPalette?: () => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  onOpenCommandPalette,
}) => {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const navItems = [
    { id: 'chat' as DesktopTab, label: 'Início & Chat', icon: MessageSquare, shortcut: 'G H' },
    { id: 'calendar' as DesktopTab, label: 'Agenda & Eventos', icon: Calendar, shortcut: 'G A' },
    { id: 'tasks' as DesktopTab, label: 'Tarefas & Foco', icon: CheckSquare, shortcut: 'G T' },
    { id: 'triggers' as DesktopTab, label: 'Vigílias & Radares', icon: Radar, shortcut: 'G R' },
    { id: 'meetings' as DesktopTab, label: 'Reuniões & Booking', icon: CalendarCheck, shortcut: 'G M' },
    { id: 'summaries' as DesktopTab, label: 'Resumos Executivos', icon: BarChart3, shortcut: 'G S' },
    { id: 'settings' as DesktopTab, label: 'Configurações', icon: Settings, shortcut: 'G C' },
  ];

  return (
    <aside
      className={`h-screen bg-[var(--bg)] border-r border-[var(--line)] flex flex-col justify-between transition-all duration-200 relative select-none z-20 shrink-0 ${
        collapsed ? 'w-20' : 'w-72'
      }`}
    >
      {/* Top Header / Brand + Search Bar */}
      <div className="p-3 space-y-3">
        {/* Brand */}
        <div className="h-14 px-2 flex items-center justify-between">
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <VitoMascot size={36} />
              <div className="flex flex-col">
                <span className="text-base font-extrabold text-[var(--ink)] tracking-tight flex items-center gap-1.5 lowercase">
                  vito
                  <span className="w-2 h-2 rounded-full bg-[var(--acc)] animate-pulse" />
                </span>
                <span className="text-[11px] text-[var(--muted)] font-mono">
                  online
                </span>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex items-center justify-center">
              <VitoMascot size={32} />
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surf)] transition-colors"
            title={collapsed ? 'Expandir barra lateral (Ctrl B)' : 'Recolher barra lateral (Ctrl B)'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Botão de Busca / Comandos estilo Vito Desktop.html */}
        {!collapsed && onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-[var(--line)] bg-[var(--surf)] text-sm text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--muted)] transition-colors"
          >
            <span className="flex items-center gap-2">
              <Search size={15} />
              <span>Buscar ou comandar…</span>
            </span>
            <kbd className="px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-[var(--bg)] border border-[var(--line)]">
              Ctrl K
            </kbd>
          </button>
        )}

        {/* Navigation Items */}
        <nav className="space-y-1.5 pt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3.5 py-3 px-3.5 rounded-xl text-base font-semibold transition-all group ${
                  isActive
                    ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs'
                    : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surf)]'
                } ${collapsed ? 'justify-center px-0' : ''}`}
                title={item.label}
              >
                <Icon
                  size={22}
                  className={`shrink-0 transition-transform group-hover:scale-105 ${
                    isActive ? 'text-[var(--bg)]' : 'text-inherit'
                  }`}
                />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    <kbd
                      className={`text-[10px] font-mono font-bold opacity-60 ${
                        isActive ? 'text-[var(--bg)]' : 'text-[var(--muted)]'
                      }`}
                    >
                      {item.shortcut}
                    </kbd>
                  </>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Rodapé: Perfil de Usuário (.me) com navegação para Configurações */}
      <div className="p-3 border-t border-[var(--line)]">
        <div
          onClick={() => onSelectTab('settings')}
          className={`flex items-center gap-3 p-2.5 rounded-2xl bg-[var(--surf)] hover:bg-[var(--surf)]/80 border border-[var(--line)] cursor-pointer transition-colors ${
            collapsed ? 'justify-center p-2' : ''
          }`}
          title="Abrir configurações (G C)"
        >
          <div className="w-9 h-9 rounded-full bg-[var(--ink)] text-[var(--bg)] flex items-center justify-center text-sm font-bold shadow-sm shrink-0">
            {user?.name?.slice(0, 1).toUpperCase() || 'A'}
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[var(--ink)] truncate leading-tight">
                {user?.name || 'André Victor'}
              </p>
              <p className="text-xs text-[var(--muted)] truncate">
                {user?.email || 'victorandre280@gmail.com'}
              </p>
            </div>
          )}

          {!collapsed && (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={toggleTheme}
                className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg)] transition-colors"
                title={isDark ? 'Tema claro' : 'Tema escuro'}
              >
                {isDark ? <Sun size={17} /> : <Moon size={17} />}
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
