import React, { useState, useEffect } from 'react';
import { Sidebar, DesktopTab } from './Sidebar';
import { AIPanelDrawer } from '../chat/AIPanelDrawer';
import { CommandPalette } from './CommandPalette';
import { CalendarView } from '../calendar/CalendarView';
import { TasksView } from '../tasks/TasksView';
import { TriggersView } from '../triggers/TriggersView';
import { MeetingsView } from '../meetings/MeetingsView';
import { ProfileView } from '../profile/ProfileView';
import { useAuth } from '../../context/AuthContext';
import { Sparkles } from 'lucide-react';

export const DesktopLayout: React.FC = () => {
  const { logout } = useAuth();
  const [currentTab, setCurrentTab] = useState<DesktopTab>('calendar');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Keyboard Shortcuts: ⌘K (command palette), ⌘J (toggle AI), 1-5 (tabs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      if (isMeta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if (isMeta && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setAiPanelOpen((prev) => !prev);
      } else if (isMeta && !isNaN(Number(e.key))) {
        const num = Number(e.key);
        const tabs: DesktopTab[] = ['calendar', 'tasks', 'triggers', 'meetings', 'profile'];
        if (num >= 1 && num <= 5) {
          e.preventDefault();
          setCurrentTab(tabs[num - 1]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderActiveView = () => {
    switch (currentTab) {
      case 'calendar':
        return <CalendarView />;
      case 'tasks':
        return <TasksView />;
      case 'triggers':
        return <TriggersView />;
      case 'meetings':
        return <MeetingsView />;
      case 'profile':
        return <ProfileView />;
      default:
        return <CalendarView />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0B0D10] text-[#F1F5F9]">
      {/* Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />

      {/* Main Workspace Central Area */}
      <main className="flex-1 h-screen flex flex-col overflow-hidden relative">
        {renderActiveView()}

        {/* Floating Copilot Toggle Button (if closed) */}
        {!aiPanelOpen && (
          <button
            onClick={() => setAiPanelOpen(true)}
            className="fixed bottom-6 right-6 p-3.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-2xl shadow-xl shadow-indigo-600/30 border border-white/20 flex items-center gap-2 text-xs font-bold transition-all z-40 group"
            title="Abrir Vito Copilot (⌘J)"
          >
            <Sparkles size={16} className="group-hover:rotate-12 transition-transform" />
            <span>Copilot</span>
            <kbd className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded font-mono font-normal">⌘J</kbd>
          </button>
        )}
      </main>

      {/* Right Assistant Panel */}
      <AIPanelDrawer
        open={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
      />

      {/* Universal ⌘K Command Palette Modal */}
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectTab={(tab) => setCurrentTab(tab)}
        onToggleAIPanel={() => setAiPanelOpen(!aiPanelOpen)}
        onLogout={logout}
      />
    </div>
  );
};
