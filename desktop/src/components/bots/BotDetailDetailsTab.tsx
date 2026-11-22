import React, { useState } from 'react';
import { Play, Palette, Trash2, Plus, Lock, Cpu, ChevronDown } from 'lucide-react';
import { ActionPolicy, Bot, BotMemory, isAlwaysAskAction } from '../../types/bot';
import { VitoSwitch } from '../ui/VitoSwitch';
import { getAllowedPolicyOptions, getAppMeta } from './botHelpers';

interface BotDetailDetailsTabProps {
  bot: Bot;
  memories: BotMemory[];
  running?: boolean;
  onRunNow: () => Promise<void>;
  onOpenMascotEdit: () => void;
  onUpdateActionPolicy: (actionKey: string, policy: ActionPolicy, alwaysAsk?: boolean) => Promise<void>;
  onOpenAddAction: () => void;
  onOpenAddSkill: () => void;
  onRemoveSkill: (skillKey: string, skillName?: string) => Promise<void>;
  onUpgradeSkill: (skillKey: string) => Promise<void>;
  onToggleQuiet: (quiet: boolean) => Promise<void>;
  onOpenModelPicker: () => void;
  onAddMemory: (content: string) => Promise<void>;
  onDeleteMemory: (memId: string) => Promise<void>;
  onDeleteBot: () => Promise<void>;
}

export const BotDetailDetailsTab: React.FC<BotDetailDetailsTabProps> = ({
  bot,
  memories,
  running = false,
  onRunNow,
  onOpenMascotEdit,
  onUpdateActionPolicy,
  onOpenAddAction,
  onOpenAddSkill,
  onRemoveSkill,
  onUpgradeSkill,
  onToggleQuiet,
  onOpenModelPicker,
  onAddMemory,
  onDeleteMemory,
  onDeleteBot,
}) => {
  const [newMemory, setNewMemory] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const actions = bot.actions || [];
  const skills = bot.skills || [];
  const logs = bot.logs || [];
  const rules = bot.rules || [];

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemory.trim()) return;
    await onAddMemory(newMemory.trim());
    setNewMemory('');
  };

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* Resumo da função + Executar agora */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surf)] p-4 space-y-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Função</div>
          <p className="text-sm font-medium text-[var(--ink)] mt-1">{bot.goal}</p>
        </div>

        <button
          type="button"
          disabled={running}
          onClick={onRunNow}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-sm font-bold hover:opacity-90 disabled:opacity-50"
        >
          <Play size={15} />
          {running ? 'Executando...' : 'Executar agora'}
        </button>
        <p className="text-[11px] text-[var(--muted)] text-center">
          Um teste faz o trabalho de verdade. Ações que alteram algo continuam pedindo aprovação.
        </p>
      </div>

      {/* Aparência */}
      <button
        type="button"
        onClick={onOpenMascotEdit}
        className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-[var(--line)] bg-[var(--bg)] hover:bg-[var(--surf)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--purple-bg)] text-[var(--purple)] flex items-center justify-center">
            <Palette size={18} />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-[var(--ink)]">Aparência</div>
            <div className="text-xs text-[var(--muted)]">Editar nome, função, preset e 6 cores do mascote</div>
          </div>
        </div>
        <span className="text-xs font-bold text-[var(--blue)]">Editar</span>
      </button>

      {/* Acordeão 1: Ações & Habilidades */}
      <details open className="v-fold rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-3.5">
        <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-extrabold text-[var(--ink)]">
          <span>Ações ({actions.length}) · Habilidades ({skills.length})</span>
          <ChevronDown size={16} className="text-[var(--muted)]" />
        </summary>

        <div className="mt-3 space-y-3">
          {/* Habilidades anexadas */}
          {skills.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Habilidades</div>
              {skills.map((sk) => (
                <div key={sk.skill_key} className="p-2.5 rounded-xl border border-[var(--line)] bg-[var(--surf)] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--ink)]">
                      {sk.name || sk.skill_key} <span className="text-[var(--muted)]">v{sk.version}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveSkill(sk.skill_key, sk.name)}
                      className="text-[11px] font-semibold text-[var(--red)] hover:underline"
                    >
                      Remover
                    </button>
                  </div>

                  {sk.has_upgrade && (
                    <div className="p-2 rounded-lg bg-[var(--blue-bg)] text-xs flex items-center justify-between gap-2">
                      <span className="text-[var(--ink)]">
                        Nova versão de {sk.name} quer usar {(sk.upgrade_new_actions || []).join(', ')}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpgradeSkill(sk.skill_key)}
                        className="px-2.5 py-1 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[11px] font-bold shrink-0"
                      >
                        Atualizar
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <p className="text-[11px] text-[var(--muted)]">
                Remover uma habilidade não tira as ações do bot.
              </p>
            </div>
          )}

          {/* Políticas de ações */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Políticas de ações</div>
            {actions.map((act) => {
              const options = getAllowedPolicyOptions(act.action_key, act.always_ask);
              const isAlways = isAlwaysAskAction(act.action_key, act.always_ask);
              const disconnected = act.app_connected === false;
              const appLabel = getAppMeta(act.app_key).label;

              return (
                <div key={act.action_key} className="p-2.5 rounded-xl border border-[var(--line)] bg-[var(--surf)] space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-[var(--ink)]">{act.label || act.action_key}</div>
                      <div className="text-[11px] text-[var(--muted)]">
                        {appLabel}
                        {isAlways && ' · Sempre pede aprovação'}
                      </div>
                    </div>

                    {disconnected ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--orange-bg)] text-[var(--orange)] text-[11px] font-bold">
                        <Lock size={11} /> Precisa conectar
                      </span>
                    ) : (
                      <select
                        value={act.policy}
                        onChange={(e) =>
                          onUpdateActionPolicy(act.action_key, e.target.value as ActionPolicy, act.always_ask)
                        }
                        aria-label={`Política para ${act.label || act.action_key}`}
                        className="px-2.5 py-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-xs font-semibold text-[var(--ink)]"
                      >
                        {options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onOpenAddSkill}
              className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-xl border border-[var(--line)] bg-[var(--surf)] text-xs font-bold text-[var(--ink)] hover:border-[var(--ink)]"
            >
              <Plus size={14} /> Habilidade
            </button>
            <button
              type="button"
              onClick={onOpenAddAction}
              className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-xl border border-[var(--line)] bg-[var(--surf)] text-xs font-bold text-[var(--ink)] hover:border-[var(--ink)]"
            >
              <Plus size={14} /> Ação
            </button>
          </div>
        </div>
      </details>

      {/* Acordeão 2: Quando executar + Alterar modelo */}
      <details className="v-fold rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-3.5">
        <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-extrabold text-[var(--ink)]">
          <span>Quando executar</span>
          <ChevronDown size={16} className="text-[var(--muted)]" />
        </summary>

        <div className="mt-3 space-y-3">
          <div className="text-xs text-[var(--ink)] font-medium">
            {bot.triggers?.[0]?.label || bot.frequency || 'Sob demanda'}
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <div className="text-xs font-bold text-[var(--ink)]">Só avisar se mudar</div>
              <div className="text-[11px] text-[var(--muted)]">Evita alertas repetidos quando não há novidade</div>
            </div>
            <VitoSwitch
              checked={bot.quiet_only_on_change !== false}
              onChange={onToggleQuiet}
              aria-label="Só avisar se mudar"
            />
          </div>

          <button
            type="button"
            onClick={onOpenModelPicker}
            className="w-full flex items-center justify-between p-2.5 rounded-xl border border-[var(--line)] bg-[var(--surf)] hover:border-[var(--ink)]"
          >
            <span className="inline-flex items-center gap-2 text-xs font-bold text-[var(--ink)]">
              <Cpu size={14} className="text-[var(--blue)]" />
              Alterar modelo
            </span>
            <span className="text-xs text-[var(--muted)]">
              {bot.model_pref || 'Segue o padrão do Vito'}
            </span>
          </button>
        </div>
      </details>

      {/* Acordeão 3: Histórico e regras */}
      <details className="v-fold rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-3.5">
        <summary className="flex items-center justify-between cursor-pointer list-none text-sm font-extrabold text-[var(--ink)]">
          <span>Histórico e regras</span>
          <ChevronDown size={16} className="text-[var(--muted)]" />
        </summary>

        <div className="mt-3 space-y-4">
          {/* Execuções em 4 listas */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Execuções</div>
            {logs.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">Nenhuma execução registrada ainda.</p>
            ) : (
              logs.slice(0, 5).map((log) => (
                <div key={log.id} className="p-2.5 rounded-xl border border-[var(--line)] bg-[var(--surf)] text-xs space-y-1.5">
                  <div className="font-bold text-[var(--ink)]">{log.report?.summary || log.message}</div>
                  {log.report && (
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] text-[var(--muted)]">
                      <div><b>Verificado:</b> {log.report.verified?.length || 0}</div>
                      <div><b>Ações feitas:</b> {log.report.did?.length || 0}</div>
                      <div><b>Aguardando:</b> {log.report.waiting?.length || 0}</div>
                      <div><b>Não verificado:</b> {log.report.cant?.length || 0}</div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Memória do bot */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Memória do bot</div>
            {memories.map((mem) => (
              <div key={mem.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--surf)] text-xs">
                <span className="text-[var(--ink)]">{mem.content}</span>
                <button
                  type="button"
                  onClick={() => onDeleteMemory(mem.id)}
                  className="text-[var(--muted)] hover:text-[var(--red)] text-[11px]"
                >
                  Remover
                </button>
              </div>
            ))}
            <form onSubmit={handleAddMemory} className="flex gap-2">
              <input
                type="text"
                value={newMemory}
                onChange={(e) => setNewMemory(e.target.value)}
                placeholder="Adicionar preferência (ex: prefiro voos diretos)"
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surf)] text-xs text-[var(--ink)]"
              />
              <button type="submit" className="px-3 py-1.5 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-xs font-bold">
                Salvar
              </button>
            </form>
          </div>

          {/* Regras */}
          {rules.length > 0 && (
            <div className="space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Regras</div>
              <ul className="list-disc list-inside text-xs text-[var(--muted)] space-y-0.5">
                {rules.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>

      {/* Excluir bot */}
      {!confirmDelete ? (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-[var(--red)]/40 text-[var(--red)] text-xs font-bold hover:bg-[var(--red-bg)] transition-colors"
        >
          <Trash2 size={14} /> Excluir bot
        </button>
      ) : (
        <div className="p-3 rounded-2xl border border-[var(--red)]/50 bg-[var(--red-bg)] flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-[var(--red)]">Excluir este bot?</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1 rounded-lg bg-[var(--bg)] text-xs font-semibold text-[var(--ink)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onDeleteBot}
              className="px-3 py-1 rounded-lg bg-[var(--red)] text-white text-xs font-bold"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
