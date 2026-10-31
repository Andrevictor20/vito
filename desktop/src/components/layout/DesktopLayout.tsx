import React, { useState, useEffect } from 'react';
import { Sidebar, DesktopTab } from './Sidebar';
import { ChatView } from '../chat/ChatView';
import { CommandPalette } from './CommandPalette';
import { CalendarView } from '../calendar/CalendarView';
import { TasksView } from '../tasks/TasksView';
import { TriggersView } from '../triggers/TriggersView';
import { MeetingsView } from '../meetings/MeetingsView';
import { ExecutiveSummariesView } from '../summaries/ExecutiveSummariesView';
import { SettingsView } from '../profile/SettingsView';
import { SettingsModal } from '../profile/SettingsModal';
import { MiniChatWidget } from '../chat/MiniChatWidget';
import { useAuth } from '../../context/AuthContext';

export const DesktopLayout: React.FC = () => {
  const { logout } = useAuth();
  const [currentTab, setCurrentTab] = useState<DesktopTab>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatPrompt, setChatPrompt] = useState<string | undefined>();

  // Keyboard Shortcuts globais: ⌘K, ⌘B, G+letra, C, Escape (AC-08)
  useEffect(() => {
    let gPressed = false;
    let gTimeout: any = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

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

      // Atalhos que só disparam fora de inputs de texto
      if (!isInput && !isMeta) {
        if (gPressed) {
          gPressed = false;
          clearTimeout(gTimeout);
          const key = e.key.toLowerCase();
          const tabMap: Record<string, DesktopTab> = {
            a: 'calendar',
            t: 'tasks',
            r: 'triggers',
            m: 'meetings',
            s: 'summaries',
            h: 'chat',
            c: 'settings',
          };
          if (tabMap[key]) {
            e.preventDefault();
            setCurrentTab(tabMap[key]);
            return;
          }
        }

        if (e.key.toLowerCase() === 'g') {
          gPressed = true;
          gTimeout = setTimeout(() => { gPressed = false; }, 1200);
          return;
        }

        if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          setCurrentTab('tasks');
          return;
        }
      }

      if (isMeta && !isNaN(Number(e.key))) {
        const num = Number(e.key);
        const tabs: DesktopTab[] = ['chat', 'calendar', 'tasks', 'triggers', 'meetings', 'summaries'];
        if (num >= 1 && num <= 6) {
          e.preventDefault();
          setCurrentTab(tabs[num - 1]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(gTimeout);
    };
  }, []);

  const renderActiveView = () => {
    switch (currentTab) {
      case 'chat':
        return (
          <ChatView
            initialPrompt={chatPrompt}
            onNavigateTab={(tab) => setCurrentTab(tab as DesktopTab)}
          />
        );
      case 'calendar':
        return <CalendarView onNavigateToSummaries={() => setCurrentTab('summaries')} />;
      case 'tasks':
        return <TasksView />;
      case 'triggers':
        return (
          <TriggersView
            onOpenChatWithPrompt={(prompt) => {
              setChatPrompt(prompt);
              setCurrentTab('chat');
            }}
          />
        );
      case 'meetings':
        return <MeetingsView />;
      case 'summaries':
        return (
          <ExecutiveSummariesView
            onBack={() => setCurrentTab('calendar')}
            onOpenChatWithPrompt={(prompt) => {
              setChatPrompt(prompt);
              setCurrentTab('chat');
            }}
          />
        );
      case 'settings':
        return <SettingsView />;
      default:
        return <ChatView />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8F9FA] dark:bg-[#0B0D10] text-zinc-900 dark:text-[#FAFAFA] transition-colors duration-200">
      {/* Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          if (tab !== 'chat') setChatPrompt(undefined);
          setCurrentTab(tab);
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Main Workspace Central Area */}
      <main className="flex-1 h-screen flex flex-col overflow-hidden relative">
        {renderActiveView()}
      </main>

      {/* Mini Chat Widget no canto inferior direito nas outras telas */}
      {currentTab !== 'chat' && (
        <MiniChatWidget
          onExpandToFullChat={(prompt) => {
            if (prompt) setChatPrompt(prompt);
            setCurrentTab('chat');
          }}
        />
      )}

      {/* Toki-Style Settings & Profile Modal */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Universal ⌘K Command Palette Modal */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectTab={(tab) => {
          if (tab !== 'chat') setChatPrompt(undefined);
          setCurrentTab(tab as DesktopTab);
        }}
        onToggleAIPanel={() => setCurrentTab('chat')}
        onLogout={logout}
        onOpenSettings={() => setSettingsOpen(true)}
      />
    </div>
  );
};
