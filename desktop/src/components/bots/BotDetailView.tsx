import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ActionPolicy, Bot, BotChatMessage, BotMemory, SkillPackage } from '../../types/bot';
import { PendingDecision } from '../../services/api/botsApi';
import { VitoSwitch } from '../ui/VitoSwitch';
import { BotDetailChatTab } from './BotDetailChatTab';
import { BotDetailDetailsTab } from './BotDetailDetailsTab';
import { AddActionSheet, AddSkillSheet, ModelPickerSheet } from './BotActionSheets';

interface BotDetailViewProps {
  bot: Bot;
  messages: BotChatMessage[];
  memories: BotMemory[];
  allSkills: SkillPackage[];
  busy?: boolean;
  happy?: boolean;
  onBack?: () => void;
  onToggle: (id: string, active: boolean) => Promise<void>;
  onRunNow: (id: string) => Promise<unknown>;
  onSendMessage: (id: string, message: string) => Promise<unknown>;
  onResolvePending: (
    botId: string,
    confirmationId: string,
    decision: PendingDecision,
    actionKey?: string,
    alwaysAsk?: boolean
  ) => Promise<void>;
  onOpenMascotEdit: (bot: Bot) => void;
  onAddAction: (id: string, actionKey: string, policy?: ActionPolicy) => Promise<void>;
  onUpdateActionPolicy: (
    id: string,
    actionKey: string,
    policy: ActionPolicy,
    alwaysAsk?: boolean
  ) => Promise<void>;
  onAddSkill: (id: string, skillKey: string) => Promise<void>;
  onRemoveSkill: (id: string, skillKey: string, skillName?: string) => Promise<void>;
  onUpgradeSkill: (id: string, skillKey: string) => Promise<void>;
  onToggleQuiet: (id: string, quiet: boolean) => Promise<void>;
  onUpdateModel: (id: string, modelPref: string) => Promise<void>;
  onAddMemory: (id: string, content: string) => Promise<unknown>;
  onDeleteMemory: (id: string, memId: string) => Promise<void>;
  onDeleteBot: (id: string) => Promise<void>;
  onOpenMainChat?: (prompt?: string) => void;
}

export const BotDetailView: React.FC<BotDetailViewProps> = ({
  bot,
  messages,
  memories,
  allSkills,
  busy = false,
  happy = false,
  onBack,
  onToggle,
  onRunNow,
  onSendMessage,
  onResolvePending,
  onOpenMascotEdit,
  onAddAction,
  onUpdateActionPolicy,
  onAddSkill,
  onRemoveSkill,
  onUpgradeSkill,
  onToggleQuiet,
  onUpdateModel,
  onAddMemory,
  onDeleteMemory,
  onDeleteBot,
  onOpenMainChat,
}) => {
  const [tab, setTab] = useState<'chat' | 'details'>('chat');
  const [showAddAction, setShowAddAction] = useState(false);
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);

  const isActive = bot.status !== 'paused';

  return (
    <div className="flex flex-col h-full bg-[var(--bg)] rounded-3xl border border-[var(--line)] overflow-hidden">
      {/* Cabeçalho do detalhe #s-rdd */}
      <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="lg:hidden p-1.5 rounded-xl border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--surf)]"
              aria-label="Voltar"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-[var(--ink)] truncate">{bot.title}</h2>
            <p className="text-xs text-[var(--muted)] truncate">
              {bot.category || 'Geral'} · {isActive ? 'Ativo' : 'Pausado'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="inline-flex rounded-xl bg-[var(--surf)] p-0.5 border border-[var(--line)]">
            <button
              type="button"
              onClick={() => setTab('chat')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                tab === 'chat'
                  ? 'bg-[var(--bg)] text-[var(--ink)] shadow-2xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => setTab('details')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                tab === 'details'
                  ? 'bg-[var(--bg)] text-[var(--ink)] shadow-2xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Detalhes
            </button>
          </div>

          <VitoSwitch
            checked={isActive}
            onChange={(checked) => onToggle(bot.id, checked)}
            aria-label={`Ativar ou pausar ${bot.title}`}
          />
        </div>
      </div>

      {/* Corpo: Chat | Detalhes */}
      <div className="flex-1 min-h-0">
        {tab === 'chat' ? (
          <BotDetailChatTab
            bot={bot}
            messages={messages}
            busy={busy}
            happy={happy}
            onSendMessage={async (msg) => {
              await onSendMessage(bot.id, msg);
            }}
            onRunNow={async () => {
              await onRunNow(bot.id);
            }}
            onResolvePending={onResolvePending}
            onOpenMainChat={onOpenMainChat}
          />
        ) : (
          <BotDetailDetailsTab
            bot={bot}
            memories={memories}
            running={busy}
            onRunNow={async () => {
              await onRunNow(bot.id);
            }}
            onOpenMascotEdit={() => onOpenMascotEdit(bot)}
            onUpdateActionPolicy={(actionKey, policy, alwaysAsk) =>
              onUpdateActionPolicy(bot.id, actionKey, policy, alwaysAsk)
            }
            onOpenAddAction={() => setShowAddAction(true)}
            onOpenAddSkill={() => setShowAddSkill(true)}
            onRemoveSkill={(skillKey, skillName) => onRemoveSkill(bot.id, skillKey, skillName)}
            onUpgradeSkill={(skillKey) => onUpgradeSkill(bot.id, skillKey)}
            onToggleQuiet={(quiet) => onToggleQuiet(bot.id, quiet)}
            onOpenModelPicker={() => setShowModelPicker(true)}
            onAddMemory={async (content) => {
              await onAddMemory(bot.id, content);
            }}
            onDeleteMemory={(memId) => onDeleteMemory(bot.id, memId)}
            onDeleteBot={() => onDeleteBot(bot.id)}
          />
        )}
      </div>

      {showAddAction && (
        <AddActionSheet
          existingActionKeys={(bot.actions || []).map((a) => a.action_key)}
          onClose={() => setShowAddAction(false)}
          onAdd={(actionKey, policy) => onAddAction(bot.id, actionKey, policy)}
        />
      )}

      {showAddSkill && (
        <AddSkillSheet
          skills={allSkills}
          existingSkillKeys={(bot.skills || []).map((s) => s.skill_key)}
          onClose={() => setShowAddSkill(false)}
          onAdd={(skillKey) => onAddSkill(bot.id, skillKey)}
        />
      )}

      {showModelPicker && (
        <ModelPickerSheet
          currentModelPref={bot.model_pref}
          onClose={() => setShowModelPicker(false)}
          onSave={(modelPref) => onUpdateModel(bot.id, modelPref)}
        />
      )}
    </div>
  );
};
