import React, { useState } from 'react';
import { Sparkles, Bot as BotIcon, RefreshCw, WifiOff, Activity, Undo2 } from 'lucide-react';
import { useBots } from '../../hooks/useBots';
import { Bot, BotSkin, BotTemplate, SkillPackage } from '../../types/bot';
import { BotCard } from './BotCard';
import { BotCatalogTab } from './BotCatalogTab';
import { BotDetailView } from './BotDetailView';
import { BotMascotStudio } from './BotMascotStudio';
import { NewBotSheet, SkillDetailSheet, TemplateSheet } from './BotCatalogSheets';
import { getBotsHeaderSubtitle, VITO_CHIP_PROMPTS } from './botHelpers';
import { MASCOT_PRESETS, parseBotSkin } from './mascotPalettes';

interface BotsViewProps {
  onOpenChatWithPrompt?: (prompt: string) => void;
}

export const BotsView: React.FC<BotsViewProps> = ({ onOpenChatWithPrompt }) => {
  const {
    bots,
    templates,
    skills,
    apps,
    activity,
    selectedBotId,
    setSelectedBotId,
    selectedBot,
    chatMessages,
    memories,
    loading,
    error,
    isOffline,
    busyBotIds,
    happyBotIds,
    undoToast,
    dismissUndoToast,
    refresh,
    createBot,
    updateBot,
    toggleBot,
    deleteBot,
    runBot,
    sendBotChat,
    addAction,
    updateActionPolicy,
    addSkill,
    removeSkill,
    upgradeSkill,
    addMemory,
    deleteMemory,
    resolvePending,
    updateModel,
    suggestApp,
  } = useBots();

  const [mainTab, setMainTab] = useState<'mine' | 'catalog'>('mine');
  const [showNewBotSheet, setShowNewBotSheet] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<BotTemplate | null>(null);
  const [activeSkill, setActiveSkill] = useState<SkillPackage | null>(null);
  const [studioMode, setStudioMode] = useState<{
    open: boolean;
    editingBot?: Bot;
    draftTitle?: string;
    draftGoal?: string;
    draftSkin?: BotSkin;
    templateKey?: string;
  }>({ open: false });

  const activeCount = bots.filter((b) => b.status !== 'paused').length;
  const subtitle = getBotsHeaderSubtitle(bots);

  if (studioMode.open) {
    return (
      <div className="h-full overflow-y-auto p-6 bg-[var(--page)]/30">
        <BotMascotStudio
          initialTitle={studioMode.editingBot?.title || studioMode.draftTitle}
          initialGoal={studioMode.editingBot?.goal || studioMode.draftGoal}
          initialSkin={
            studioMode.editingBot
              ? parseBotSkin(studioMode.editingBot)
              : studioMode.draftSkin || MASCOT_PRESETS[1]
          }
          isEditing={Boolean(studioMode.editingBot)}
          onCancel={() => setStudioMode({ open: false })}
          onSave={async ({ title, goal, skin }) => {
            if (studioMode.editingBot) {
              await updateBot(studioMode.editingBot.id, {
                title,
                goal,
                skin_json: JSON.stringify(skin),
                skin,
              });
            } else {
              await createBot({
                template_key: studioMode.templateKey,
                title,
                goal,
                skin,
                skin_json: JSON.stringify(skin),
              });
              setMainTab('mine');
            }
            setStudioMode({ open: false });
          }}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--page)]/20">
      {/* Cabeçalho */}
      <header className="px-6 py-4 border-b border-[var(--line)] bg-[var(--bg)] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--ink)] tracking-tight">Bots</h1>
          <p className="text-xs font-medium text-[var(--muted)] mt-0.5">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Segmento 2 abas: Meus bots · Catálogo */}
          <div className="inline-flex rounded-xl bg-[var(--surf)] p-1 border border-[var(--line)]">
            <button
              type="button"
              onClick={() => setMainTab('mine')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                mainTab === 'mine'
                  ? 'bg-[var(--bg)] text-[var(--ink)] shadow-2xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Meus bots ({bots.length})
            </button>
            <button
              type="button"
              onClick={() => setMainTab('catalog')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                mainTab === 'catalog'
                  ? 'bg-[var(--bg)] text-[var(--ink)] shadow-2xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Catálogo
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowNewBotSheet(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-xs font-bold hover:opacity-90 transition-opacity"
          >
            <Sparkles size={14} />
            Novo bot
          </button>
        </div>
      </header>

      {/* Banner offline (cache) */}
      {isOffline && (
        <div className="px-6 py-2 bg-[var(--orange-bg)] border-b border-[var(--orange)]/30 flex items-center justify-between text-xs text-[var(--orange)] font-semibold">
          <span className="inline-flex items-center gap-1.5">
            <WifiOff size={14} /> Modo offline: exibindo dados salvos em cache.
          </span>
          <button type="button" onClick={refresh} className="underline font-bold">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Conteúdo principal */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Coluna esquerda / principal */}
        <div className={`flex-1 min-w-0 overflow-y-auto p-6 space-y-6 ${selectedBot ? 'lg:max-w-[460px] lg:border-r lg:border-[var(--line)]' : ''}`}>
          {loading ? (
            <div className="space-y-3" aria-label="Carregando bots">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-2xl border border-[var(--line)] bg-[var(--surf)] animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl border border-[var(--red)]/30 bg-[var(--red-bg)] text-center space-y-3">
              <p className="text-sm font-bold text-[var(--red)]">{error}</p>
              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-xs font-bold"
              >
                <RefreshCw size={13} /> Tentar novamente
              </button>
            </div>
          ) : mainTab === 'catalog' ? (
            <BotCatalogTab
              templates={templates}
              skills={skills}
              onOpenMascotCreate={() => setStudioMode({ open: true })}
              onSelectTemplate={(tpl) => setActiveTemplate(tpl)}
              onSelectSkill={(sk) => setActiveSkill(sk)}
              onSuggestApp={suggestApp}
            />
          ) : (
            <>
              {/* Bloco Peça ao Vito */}
              <section className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  Peça ao Vito
                </div>
                <div className="flex flex-wrap gap-2">
                  {VITO_CHIP_PROMPTS.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => onOpenChatWithPrompt?.(chip.prompt)}
                      className="px-3 py-1.5 rounded-full border border-[var(--line)] bg-[var(--bg)] hover:border-[var(--ink)] text-xs font-semibold text-[var(--ink)] transition-colors"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Seção Ativos x de y */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                    Ativos {activeCount} de {bots.length}
                  </h2>
                </div>

                {bots.length === 0 ? (
                  <div className="p-8 rounded-3xl border border-dashed border-[var(--line)] bg-[var(--bg)] text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--surf)] text-[var(--muted)] flex items-center justify-center mx-auto">
                      <BotIcon size={24} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--ink)]">Nenhum bot criado ainda</h3>
                      <p className="text-xs text-[var(--muted)] mt-1">
                        Ative um bot pronto do catálogo ou crie um com a sua aparência.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMainTab('catalog')}
                      className="px-4 py-2 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-xs font-bold"
                    >
                      Explorar catálogo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bots.map((bot) => (
                      <BotCard
                        key={bot.id}
                        bot={bot}
                        globalApps={apps}
                        selected={selectedBotId === bot.id}
                        busy={Boolean(busyBotIds[bot.id])}
                        happy={Boolean(happyBotIds[bot.id])}
                        onSelect={(b) => setSelectedBotId(b.id)}
                        onToggle={toggleBot}
                        onResolvePending={resolvePending}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Atividade recente */}
              {activity.length > 0 && (
                <section className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                    <Activity size={13} /> Atividade recente
                  </div>
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] divide-y divide-[var(--line)]">
                    {activity.slice(0, 8).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedBotId(item.bot_id)}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-[var(--surf)] transition-colors"
                      >
                        <div className="text-xs font-bold text-[var(--ink)]">{item.bot_title}</div>
                        <div className="text-xs text-[var(--muted)] line-clamp-1">{item.summary}</div>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* Coluna direita: Detalhe do Bot selecionado */}
        {selectedBot && (
          <div className="flex-1 min-w-0 p-4 lg:p-6 overflow-hidden">
            <BotDetailView
              bot={selectedBot}
              messages={chatMessages}
              memories={memories}
              allSkills={skills}
              busy={Boolean(busyBotIds[selectedBot.id])}
              happy={Boolean(happyBotIds[selectedBot.id])}
              onBack={() => setSelectedBotId(null)}
              onToggle={toggleBot}
              onRunNow={runBot}
              onSendMessage={sendBotChat}
              onResolvePending={resolvePending}
              onOpenMascotEdit={(b) => setStudioMode({ open: true, editingBot: b })}
              onAddAction={addAction}
              onUpdateActionPolicy={updateActionPolicy}
              onAddSkill={addSkill}
              onRemoveSkill={removeSkill}
              onUpgradeSkill={upgradeSkill}
              onToggleQuiet={(id, quiet) => updateBot(id, { quiet_only_on_change: quiet }).then(() => undefined)}
              onUpdateModel={updateModel}
              onAddMemory={addMemory}
              onDeleteMemory={deleteMemory}
              onDeleteBot={deleteBot}
              onOpenMainChat={(prompt) => onOpenChatWithPrompt?.(prompt || '')}
            />
          </div>
        )}
      </div>

      {/* Toast Desfazer (AC-10) */}
      {undoToast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--ink)] text-[var(--bg)] text-xs font-semibold shadow-lg">
          <span>{undoToast.message}</span>
          <button
            type="button"
            onClick={async () => {
              await undoToast.onUndo();
              dismissUndoToast();
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg)] text-[var(--ink)] font-bold"
          >
            <Undo2 size={12} /> Desfazer
          </button>
        </div>
      )}

      {showNewBotSheet && (
        <NewBotSheet
          onClose={() => setShowNewBotSheet(false)}
          onConfigureMascot={() => setStudioMode({ open: true })}
          onAskVito={() =>
            onOpenChatWithPrompt?.('Vito, me ajude a criar um novo bot para acompanhar algo importante.')
          }
        />
      )}

      {activeTemplate && (
        <TemplateSheet
          template={activeTemplate}
          apps={apps}
          skills={skills}
          onClose={() => setActiveTemplate(null)}
          onActivate={async (templateKey, skin) => {
            await createBot({
              template_key: templateKey,
              skin,
              skin_json: JSON.stringify(skin),
            });
            setMainTab('mine');
          }}
          onCustomizeMascot={(tpl, skin) =>
            setStudioMode({
              open: true,
              templateKey: tpl.key,
              draftTitle: tpl.name,
              draftGoal: tpl.goal,
              draftSkin: skin,
            })
          }
        />
      )}

      {activeSkill && (
        <SkillDetailSheet
          skill={activeSkill}
          bots={bots}
          apps={apps}
          onClose={() => setActiveSkill(null)}
          onAddToBot={addSkill}
        />
      )}
    </div>
  );
};
