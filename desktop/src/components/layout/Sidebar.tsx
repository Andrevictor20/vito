import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  MessageSquare,
  Calendar,
  CheckSquare,
  Radar,
  CalendarCheck,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  BarChart3,
} from 'lucide-react';
import { VitoMascot } from '../common/VitoMascot';

export type DesktopTab = 'chat' | 'calendar' | 'tasks' | 'triggers' | 'meetings' | 'summaries';

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
  onOpenCommandPalette: _onOpenCommandPalette,
  onOpenSettings,
}) => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const navItems = [
    { id: 'chat' as DesktopTab, label: 'Início & Chat', icon: MessageSquare, shortcut: '1' },
    { id: 'calendar' as DesktopTab, label: 'Agenda & Eventos', icon: Calendar, shortcut: '2' },
    { id: 'tasks' as DesktopTab, label: 'Tarefas & Foco', icon: CheckSquare, shortcut: '3' },
    { id: 'triggers' as DesktopTab, label: 'Vigílias & Radares', icon: Radar, shortcut: '4' },
    { id: 'meetings' as DesktopTab, label: 'Reuniões & Booking', icon: CalendarCheck, shortcut: '5' },
    { id: 'summaries' as DesktopTab, label: 'Resumos Executivos', icon: BarChart3, shortcut: '6' },
  ];

  return (
    <aside
      className={`h-screen bg-white dark:bg-[#14171C] border-r border-zinc-200/80 dark:border-[#222730] flex flex-col justify-between transition-all duration-300 relative select-none z-20 ${
        collapsed ? 'w-20' : 'w-72'
      }`}
    >
      {/* Top Header / Brand */}
      <div>
        <div className="h-16 px-4 flex items-center justify-between border-b border-zinc-100 dark:border-white/5">
          {!collapsed ? (
            <div className="flex items-center gap-2.5">
              <VitoMascot size={32} />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-1.5 lowercase">
                  vito
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  Online
                </span>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex items-center justify-center">
              <VitoMascot size={28} />
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
            title={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3.5 py-3 px-3.5 rounded-2xl text-sm font-semibold transition-all group ${
                  isActive
                    ? 'bg-zinc-900 text-white dark:bg-white/10 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
                } ${collapsed ? 'justify-center px-0' : ''}`}
                title={item.label}
              >
                <Icon
                  size={20}
                  className={`transition-transform group-hover:scale-105 shrink-0 ${
                    isActive ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200'
                  }`}
                />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    <span className="text-xs font-mono opacity-0 group-hover:opacity-60 transition-opacity text-zinc-400">
                      ⌘{item.shortcut}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom User Profile with Settings Modal, Theme Switcher and Logout */}
      <div className="p-3 border-t border-zinc-100 dark:border-white/5">
        <div
          onClick={onOpenSettings}
          className={`flex items-center gap-2.5 p-2 rounded-2xl bg-zinc-50 hover:bg-zinc-100 dark:bg-[#0B0D10]/50 dark:hover:bg-[#1C2026] border border-zinc-200/80 dark:border-white/5 cursor-pointer transition-colors ${
            collapsed ? 'justify-center p-1.5' : ''
          }`}
          title="Abrir configurações da conta"
        >
          <div className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-[#09090B] flex items-center justify-center text-xs font-bold shadow-sm shrink-0">
            {user?.name?.slice(0, 1).toUpperCase() || 'V'}
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                {user?.name || 'Usuário'}
              </p>
              <p className="text-xs text-zinc-400 truncate">{user?.email}</p>
            </div>
          )}

          {!collapsed && (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {/* Theme Toggle Button right in sidebar */}
              <button
                type="button"
                onClick={toggleTheme}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-white/10 transition-colors"
                title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              >
                {isDark ? <Sun size={15} /> : <Moon size={15} />}
              </button>

              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                title="Encerrar sessão"
              >
                <LogOut size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
