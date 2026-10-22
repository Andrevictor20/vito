import React from 'react';
import { ConversationSession } from '../../types';
import { groupSessionsByDate } from '../../utils/chatHistoryGrouping';
import { MessageSquare, Plus, Trash2, Pin, PinOff } from 'lucide-react';

interface ChatHistoryPanelProps {
  conversations: ConversationSession[];
  activeSessionId?: string;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onTogglePin: (id: string) => void;
  onNewChat: () => void;
}

export const ChatHistoryPanel: React.FC<ChatHistoryPanelProps> = ({
  conversations,
  activeSessionId,
  onSelectConversation,
  onDeleteConversation,
  onTogglePin,
  onNewChat,
}) => {
  const pinnedConversations = conversations.filter((c) => c.pinned);
  const unpinnedConversations = conversations.filter((c) => !c.pinned);
  const pinnedGroups = pinnedConversations.length > 0 ? [{ key: 'pinned', title: 'Fixados', sessions: pinnedConversations }] : [];
  const unpinnedGroups = groupSessionsByDate(unpinnedConversations);
  const allGroups = [...pinnedGroups, ...unpinnedGroups];

  return (
    <div className="w-72 h-full bg-zinc-50/70 dark:bg-[#0E1014] border-r border-zinc-200/80 dark:border-[#222730] flex flex-col justify-between shrink-0 select-none transition-colors">
      {/* Top Header */}
      <div className="p-4 border-b border-zinc-200/60 dark:border-white/5 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2.5">
            <span>Conversas</span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-200 dark:bg-[#1C2026] text-zinc-600 dark:text-zinc-300">
              {conversations.length}
            </span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">Continue de onde parou</p>
        </div>

        <button
          onClick={onNewChat}
          className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-white/10 transition-colors"
          title="Nova Conversa"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Scrollable Groups List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {conversations.length === 0 ? (
          <div className="py-12 text-center px-3">
            <MessageSquare size={24} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
            <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Nenhuma conversa salva</p>
            <p className="text-xs text-zinc-400 mt-1">Inicie um novo chat com o Vito</p>
          </div>
        ) : (
          allGroups.map((group) => (
            <div key={group.key} className="space-y-0.5">
              <div className="flex items-center justify-between px-2 py-0.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                <span>{group.title}</span>
                {group.key === 'pinned' && <Pin size={10} className="text-emerald-500" />}
              </div>

              {group.sessions.map((session) => {
                const isActive = session.id === activeSessionId;
                return (
                  <div
                    key={session.id}
                    onClick={() => onSelectConversation(session.id)}
                    className={`group relative flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition-all ${
                      isActive
                        ? 'bg-zinc-200/80 dark:bg-[#1C2026]/80 text-zinc-900 dark:text-white shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/50 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-3">
                      <MessageSquare
                        size={14}
                        className={`shrink-0 ${isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate leading-snug">
                          {session.title || 'Conversa sem título'}
                        </p>
                        <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {session.preview || 'Sem mensagens recentes'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePin(session.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-emerald-500/10 hover:text-emerald-500 text-zinc-400 transition-all shrink-0"
                        title={session.pinned ? 'Desfixar conversa' : 'Fixar conversa'}
                      >
                        {session.pinned ? <Pin size={12} /> : <PinOff size={12} />}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(session.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/10 hover:text-red-500 text-zinc-400 transition-all shrink-0"
                        title="Excluir conversa"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
};