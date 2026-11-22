import React, { useEffect, useState } from 'react';
import { ArrowLeft, BarChart3, Bell, Link2, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useReduceMotion } from '../../theme/motion';
import { BotsView } from '../bots/BotsView';
import { CalendarView } from '../calendar/CalendarView';
import { ChatView } from '../chat/ChatView';
import { MiniChatWidget } from '../chat/MiniChatWidget';
import { MeetingsView } from '../meetings/MeetingsView';
import { SettingsModal } from '../profile/SettingsModal';
import { SettingsView } from '../profile/SettingsView';
import { ExecutiveSummariesView } from '../summaries/ExecutiveSummariesView';
import { TasksView } from '../tasks/TasksView';
import { CommandPalette } from './CommandPalette';
import { DesktopTab, Sidebar } from './Sidebar';

export const DesktopLayout: React.FC = () => {
  const { logout } = useAuth();
  const reduceMotion = useReduceMotion();
  const [currentTab, setCurrentTab] = useState<DesktopTab>('chat');
  const [transitionClass, setTransitionClass] = useState<'tr-tab' | 'tr-push' | 'tr-pop'>('tr-tab');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatPrompt, setChatPrompt] = useState<string | undefined>();

  const navigateTab = (next: DesktopTab, mode: 'tr-tab' | 'tr-push' | 'tr-pop' = 'tr-tab') => {
    if (next !== 'chat') setChatPrompt(undefined);
    setTransitionClass(mode);
    setCurrentTab(next);
  };

  useEffect(() => {
    const onOpenNotifs = () => navigateTab('notifications', 'tr-push');
    const onOpenProfile = () => navigateTab('settings', 'tr-push');
    window.addEventListener('vito:open-notifications', onOpenNotifs);
    window.addEventListener('vito:open-profile', onOpenProfile);
    return () => {
      window.removeEventListener('vito:open-notifications', onOpenNotifs);
      window.removeEventListener('vito:open-profile', onOpenProfile);
    };
  }, []);

  useEffect(() => {
    let gPressed = false;
    let gTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (isMeta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (isMeta && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
        return;
      }

      if (isMeta && e.key === ',') {
        e.preventDefault();
        setSettingsOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
        setSettingsOpen(false);
        return;
      }

      if (!isInput && !isMeta) {
        if (gPressed) {
          gPressed = false;
          if (gTimeout) clearTimeout(gTimeout);
          const key = e.key.toLowerCase();
          const tabMap: Record<string, DesktopTab> = {
            a: 'calendar',
            t: 'tasks',
            f: 'finance',
            r: 'triggers',
            b: 'triggers',
            m: 'meetings',
            s: 'summaries',
            h: 'chat',
            c: 'settings',
            n: 'notifications',
          };
          if (tabMap[key]) {
            e.preventDefault();
            navigateTab(tabMap[key], 'tr-tab');
            return;
          }
        }

        if (e.key.toLowerCase() === 'g') {
          gPressed = true;
          gTimeout = setTimeout(() => {
            gPressed = false;
          }, 1200);
          return;
        }

        if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          navigateTab('tasks', 'tr-tab');
          return;
        }
      }

      if (isMeta && !Number.isNaN(Number(e.key))) {
        const num = Number(e.key);
        const tabs: DesktopTab[] = ['chat', 'calendar', 'tasks', 'finance', 'triggers'];
        if (num >= 1 && num <= tabs.length) {
          e.preventDefault();
          navigateTab(tabs[num - 1], 'tr-tab');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gTimeout) clearTimeout(gTimeout);
    };
  }, []);

  const renderActiveView = () => {
    switch (currentTab) {
      case 'chat':
        return (
          <ChatView
            initialPrompt={chatPrompt}
            onNavigateTab={(tab) => navigateTab(tab as DesktopTab, 'tr-push')}
          />
        );
      case 'calendar':
        return (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Agenda Header bar (.sbar) com gatilho #open-book */}
            <div className="sbar px-6 py-2.5 border-b border-[var(--line)] flex items-center justify-between shrink-0">
              <span className="text-xs font-medium text-[var(--muted)]">
                Agenda &amp; Agendamentos
              </span>
              <div className="flex items-center gap-2">
                <button
                  id="open-book"
                  type="button"
                  onClick={() => navigateTab('meetings', 'tr-push')}
                  className="v5-press inline-flex items-center gap-2 h-9 px-4 rounded-full bg-[var(--btn)] text-[var(--ink)] text-xs font-medium hover:opacity-90"
                >
                  <Link2 size={14} />
                  <span>Links de agendamento</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateTab('summaries', 'tr-push')}
                  className="v5-press inline-flex items-center gap-2 h-9 px-4 rounded-full bg-[var(--surf)] text-[var(--ink)] text-xs font-medium hover:bg-[var(--btn)]"
                >
                  <BarChart3 size={14} />
                  <span>Resumos</span>
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <CalendarView onNavigateToSummaries={() => navigateTab('summaries', 'tr-push')} />
            </div>
          </div>
        );
      case 'tasks':
        return <TasksView />;
      case 'finance':
        return (
          <div className="flex-1 flex items-center justify-center p-8 bg-[var(--bg)]">
            <div className="v5-card max-w-md w-full p-7 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--fin-bg)] text-[var(--fin)] mx-auto flex items-center justify-center">
                <Wallet size={22} />
              </div>
              <h2 className="text-xl font-medium text-[var(--ink)] tracking-tight">
                Finanças
              </h2>
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                O módulo Open Finance e Pluggy BYOK está disponível no app mobile e será integrado nesta visualização em breve.
              </p>
            </div>
          </div>
        );
      case 'triggers':
        return (
          <BotsView
            onOpenChatWithPrompt={(prompt) => {
              setChatPrompt(prompt);
              navigateTab('chat', 'tr-tab');
            }}
          />
        );
      case 'meetings':
        return (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="sbar px-6 py-2.5 border-b border-[var(--line)] flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => navigateTab('calendar', 'tr-pop')}
                className="v5-press w-9 h-9 rounded-full bg-[var(--btn)] text-[var(--ink)] flex items-center justify-center"
                aria-label="Voltar para Agenda"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <h2 className="text-sm font-medium text-[var(--ink)]">Agendamentos</h2>
                <p className="text-xs text-[var(--muted)]">Links e votações de horário</p>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <MeetingsView />
            </div>
          </div>
        );
      case 'summaries':
        return (
          <ExecutiveSummariesView
            onBack={() => navigateTab('calendar', 'tr-pop')}
            onOpenChatWithPrompt={(prompt) => {
              setChatPrompt(prompt);
              navigateTab('chat', 'tr-tab');
            }}
          />
        );
      case 'notifications':
        return (
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg)]">
            <div className="sbar px-6 py-3 border-b border-[var(--line)] flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => navigateTab('chat', 'tr-pop')}
                className="v5-press w-10 h-10 rounded-full bg-[var(--btn)] text-[var(--ink)] flex items-center justify-center"
                aria-label="Voltar para Conversas"
              >
                <ArrowLeft size={17} />
              </button>
              <div>
                <h1 className="text-xl font-medium text-[var(--ink)] tracking-tight">Notificações</h1>
                <p className="text-xs text-[var(--muted)]">Central de alertas e aprovações</p>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="v5-card max-w-md w-full p-7 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[var(--surf)] text-[var(--ink)] mx-auto flex items-center justify-center">
                  <Bell size={22} />
                </div>
                <h2 className="text-lg font-medium text-[var(--ink)]">Tudo em dia!</h2>
                <p className="text-sm text-[var(--muted)]">
                  Novas aprovações de bots, tarefas atrasadas e votações aparecerão aqui.
                </p>
              </div>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="sbar px-6 py-2.5 border-b border-[var(--line)] flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => navigateTab('chat', 'tr-pop')}
                className="v5-press w-9 h-9 rounded-full bg-[var(--btn)] text-[var(--ink)] flex items-center justify-center"
                aria-label="Voltar para Conversas"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <h2 className="text-sm font-medium text-[var(--ink)]">Perfil</h2>
                <p className="text-xs text-[var(--muted)]">Conta, autonomia e integrações</p>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <SettingsView />
            </div>
          </div>
        );
      default:
        return <ChatView />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--page)] text-[var(--ink)] transition-colors duration-200">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => navigateTab(tab, 'tr-tab')}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onOpenSettings={() => navigateTab('settings', 'tr-push')}
      />

      <main
        key={currentTab}
        className={`flex-1 h-screen flex flex-col overflow-hidden relative bg-[var(--bg)] ${
          reduceMotion ? '' : transitionClass
        }`}
      >
        {renderActiveView()}
      </main>

      {currentTab !== 'chat' && (
        <MiniChatWidget
          onExpandToFullChat={(prompt) => {
            if (prompt) setChatPrompt(prompt);
            navigateTab('chat', 'tr-tab');
          }}
        />
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectTab={(tab) => navigateTab(tab as DesktopTab, 'tr-tab')}
        onToggleAIPanel={() => navigateTab('chat', 'tr-tab')}
        onLogout={logout}
        onOpenSettings={() => navigateTab('settings', 'tr-push')}
      />
    </div>
  );
};
