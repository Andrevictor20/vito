import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Calendar,
  CheckSquare,
  Radar,
  CalendarCheck,
  User as UserIcon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Command,
} from 'lucide-react';
import { VitoMascot } from '../common/VitoMascot';

export type DesktopTab = 'calendar' | 'tasks' | 'triggers' | 'meetings' | 'profile';

interface SidebarProps {
  currentTab: DesktopTab;
  onSelectTab: (tab: DesktopTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenCommandPalette: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  onOpenCommandPalette,
}) => {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'calendar' as DesktopTab, label: 'Agenda & Eventos', icon: Calendar, shortcut: '1' },
    { id: 'tasks' as DesktopTab, label: 'Tarefas & Foco', icon: CheckSquare, shortcut: '2' },
    { id: 'triggers' as DesktopTab, label: 'Vigílias & Radares', icon: Radar, shortcut: '3' },
    { id: 'meetings' as DesktopTab, label: 'Reuniões & Booking', icon: CalendarCheck, shortcut: '4' },
    { id: 'profile' as DesktopTab, label: 'Configurações', icon: UserIcon, shortcut: '5' },
  ];

  return (
    <aside
      className={`h-screen bg-[#14171C] border-r border-white/10 flex flex-col justify-between transition-all duration-300 relative select-none z-20 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Top Header / Brand */}
      <div>
        <div className="h-16 px-4 flex items-center justify-between border-b border-white/5">
          {!collapsed ? (
            <div className="flex items-center gap-2.5">
              <VitoMascot size={32} />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5 lowercase">
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
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            title={collapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Command Palette Button */}
        <div className="p-3">
          <button
            onClick={onOpenCommandPalette}
            className={`w-full flex items-center gap-2 py-2 px-3 rounded-lg bg-[#0B0D10] border border-white/5 hover:border-white/15 text-slate-400 hover:text-slate-200 text-xs transition-all ${
              collapsed ? 'justify-center px-0' : ''
            }`}
            title="Abrir paleta de comandos (⌘K / Ctrl+K)"
          >
            <Command size={14} className="text-indigo-400" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">Buscar ou Ação...</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-slate-400">
                  ⌘K
                </kbd>
              </>
            )}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="px-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-xl text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                } ${collapsed ? 'justify-center px-0' : ''}`}
                title={item.label}
              >
                <Icon
                  size={18}
                  className={`transition-transform group-hover:scale-105 ${
                    isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    <span className="text-[10px] font-mono opacity-0 group-hover:opacity-60 transition-opacity text-slate-400">
                      {item.shortcut}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom User Profile */}
      <div className="p-3 border-t border-white/5">
        <div
          className={`flex items-center gap-3 p-2 rounded-xl bg-[#0B0D10]/50 border border-white/5 ${
            collapsed ? 'justify-center p-1.5' : ''
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-emerald-500 flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0">
            {user?.name?.slice(0, 1).toUpperCase() || 'V'}
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name || 'Usuário'}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
            </div>
          )}

          {!collapsed && (
            <button
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Encerrar sessão"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
