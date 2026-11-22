import React, { useEffect, useRef } from 'react';
import {
  BarChart3,
  Bot,
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Moon,
  Search,
  Sun,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { triggerCircularThemeReveal, useReduceMotion } from '../../theme/motion';
import { VitoMascot } from '../common/VitoMascot';

export type DesktopTab =
  | 'chat'
  | 'calendar'
  | 'tasks'
  | 'finance'
  | 'triggers'
  | 'meetings'
  | 'summaries'
  | 'notifications'
  | 'settings';

export const DESKTOP_DOCK_TABS: ReadonlyArray<{
  id: DesktopTab;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  shortcut: string;
}> = [
  { id: 'chat', label: 'Vito', icon: MessageSquare, shortcut: 'G H' },
  { id: 'calendar', label: 'Agenda', icon: Calendar, shortcut: 'G A' },
  { id: 'tasks', label: 'Tarefas', icon: CheckSquare, shortcut: 'G T' },
  { id: 'finance', label: 'Finanças', icon: Wallet, shortcut: 'G F' },
  { id: 'triggers', label: 'Bots', icon: Bot, shortcut: 'G B' },
];

interface SidebarProps {
  currentTab: DesktopTab;
  onSelectTab: (tab: DesktopTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenCommandPalette?: () => void;
  onOpenSettings: () => void;
}

function getInitials(name?: string | null): string {
  const clean = (name || '').trim();
  if (!clean) return 'AV';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
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
  const reduceMotion = useReduceMotion();
  const prevTabRef = useRef<DesktopTab>(currentTab);

  useEffect(() => {
    prevTabRef.current = currentTab;
  }, [currentTab]);

  const initials = getInitials(user?.name);

  return (
    <aside
      className={`h-screen bg-[var(--bg)] border-r border-[var(--line)] flex flex-col justify-between transition-all duration-200 relative select-none z-20 shrink-0 ${
        collapsed ? 'w-20' : 'w-72'
      }`}
    >
      <div className="p-3 space-y-3">
        <div className="h-14 px-2 flex items-center justify-between">
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <VitoMascot size={36} />
              <div className="flex flex-col">
                <span className="text-base font-semibold text-[var(--ink)] tracking-tight flex items-center gap-1.5 lowercase">
                  vito
                  <span className="w-2 h-2 rounded-full bg-[var(--acc)]" />
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
            type="button"
            onClick={onToggleCollapse}
            className="v5-press p-1.5 rounded-full text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surf)] transition-colors"
            title={collapsed ? 'Expandir barra lateral (Ctrl B)' : 'Recolher barra lateral (Ctrl B)'}
            aria-label={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {!collapsed && onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="v5-press w-full flex items-center justify-between px-3.5 py-2.5 rounded-full border border-[var(--line)] bg-[var(--surf)] text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
          >
            <span className="flex items-center gap-2">
              <Search size={15} />
              <span>Buscar ou comandar…</span>
            </span>
            <kbd className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-[var(--bg)] border border-[var(--line)]">
              Ctrl K
            </kbd>
          </button>
        )}

        {/* 5 abas canônicas v5 */}
        <nav className="space-y-1.5 pt-1" aria-label="Navegação principal">
          {DESKTOP_DOCK_TABS.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            const justActivated = isActive && prevTabRef.current !== item.id && !reduceMotion;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`v5-press w-full flex items-center gap-3 py-2.5 px-3.5 rounded-full text-[15px] font-medium transition-all group ${
                  isActive
                    ? 'bg-[var(--ink)] text-[var(--bg)]'
                    : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surf)]'
                } ${collapsed ? 'justify-center px-0' : ''}`}
                title={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon
                  size={20}
                  className={`shrink-0 ${
                    justActivated ? 'nav-icon-bounce' : ''
                  } ${isActive ? 'text-[var(--bg)]' : 'text-inherit'}`}
                />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    <kbd
                      className={`text-[10px] font-mono opacity-60 ${
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

        {/* Atalho discreto para Resumos (sub-fluxo da Agenda) */}
        {!collapsed && (
          <div className="pt-2 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={() => onSelectTab('summaries')}
              className={`v5-press w-full flex items-center gap-3 py-2 px-3.5 rounded-full text-[13.5px] font-medium transition-colors ${
                currentTab === 'summaries'
                  ? 'bg-[var(--btn)] text-[var(--ink)]'
                  : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surf)]'
              }`}
            >
              <BarChart3 size={17} />
              <span className="flex-1 text-left truncate">Resumos da semana</span>
              <kbd className="text-[10px] font-mono opacity-60">G S</kbd>
            </button>
          </div>
        )}
      </div>

      {/* Rodapé Perfil + Toggle Tema Circular */}
      <div className="p-3 border-t border-[var(--line)]">
        <div
          onClick={() => onSelectTab('settings')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectTab('settings');
            }
          }}
          className={`v5-press v5-card flex items-center gap-3 p-2.5 cursor-pointer transition-colors ${
            collapsed ? 'justify-center p-2' : ''
          }`}
          title="Abrir Perfil (G C)"
        >
          <div className="w-9 h-9 rounded-full bg-[var(--ink)] text-[var(--bg)] flex items-center justify-center text-xs font-semibold shrink-0">
            {initials}
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--ink)] truncate leading-tight">
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
                onClick={(e) =>
                  triggerCircularThemeReveal({
                    clientX: e.clientX,
                    clientY: e.clientY,
                    applyTheme: toggleTheme,
                    reduceMotion,
                  })
                }
                className="v5-press w-9 h-9 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--btn)] transition-colors"
                title={isDark ? 'Tema claro' : 'Tema escuro'}
                aria-label={isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
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
