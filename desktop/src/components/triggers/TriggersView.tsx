import React, { useState, useEffect, useMemo } from 'react';
import { useTriggers } from '../../hooks';
import { Trigger } from '../../types';
import { CreateTriggerModal } from './CreateTriggerModal';
import { EditTriggerModal } from './EditTriggerModal';
import { DeleteTriggerModal, DeleteModalType } from './DeleteTriggerModal';
import { RadarCard } from './RadarCard';
import { TriggerDetailView } from './TriggerDetailView';
import { filterTriggersByCategory } from '../../utils/radarFilter';
import {
  Sparkles,
  Clock,
  Loader2,
  ArrowLeft,
  MoreVertical,
  Plus,
  Trash2,
  Edit3,
} from 'lucide-react';

interface TriggersViewProps {
  onOpenChatWithPrompt?: (prompt: string) => void;
}

const CATEGORIES = [
  { id: 'all', label: 'Todos' },
  { id: 'career', label: 'Carreira' },
  { id: 'finance', label: 'Finanças' },
  { id: 'public_exams', label: 'Concursos' },
  { id: 'real_estate', label: 'Imóveis' },
  { id: 'travel', label: 'Viagens' },
  { id: 'tech', label: 'Tecnologia' },
  { id: 'news', label: 'Notícias' },
];

export const TriggersView: React.FC<TriggersViewProps> = ({ onOpenChatWithPrompt }) => {
  const {
    triggers,
    setTriggers,
    loading,
    logs,
    setLogs,
    loadingLogs,
    fetchTriggers,
    fetchLogs,
    toggleTrigger,
    runTrigger,
    testTrigger,
    updateTrigger,
    deleteTrigger,
    clearTriggerLogs,
    deleteTriggerLog,
  } = useTriggers();

  const [selectedTrigger, setSelectedTrigger] = useState<Trigger | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [runningTest, setRunningTest] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Trigger | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    type: DeleteModalType;
    trigger?: Trigger;
    logId?: string;
  }>({ open: false, type: 'radar' });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (selectedTrigger?.id) {
      const updated = triggers.find((t) => t.id === selectedTrigger.id);
      if (updated) setSelectedTrigger(updated);
      fetchLogs(selectedTrigger.id);
    } else {
      setLogs([]);
    }
  }, [selectedTrigger?.id, fetchLogs, setLogs, triggers]);

  const handleToggleActive = async (tr: Trigger) => {
    const nextStatus = tr.status === 'active' ? 'paused' : 'active';
    const updated = { ...tr, status: nextStatus as Trigger['status'], active: nextStatus === 'active' };
    if (selectedTrigger?.id === tr.id) {
      setSelectedTrigger(updated);
    }
    setTriggers((prev) => prev.map((item) => (item.id === tr.id ? updated : item)));
    try {
      await toggleTrigger(tr.id, nextStatus === 'active');
    } catch {
      fetchTriggers();
    }
  };

  const handleRunVerifyNow = async (tr: Trigger) => {
    if (runningTest) return;
    setRunningTest(true);
    try {
      const newLog = await runTrigger(tr.id);
      if (newLog) {
        setLogs((prev) => [newLog, ...prev]);
      }
    } catch {
      try {
        await testTrigger(tr.id);
        await fetchLogs(tr.id);
      } catch {
        alert('Falha ao verificar radar no momento.');
      }
    } finally {
      setRunningTest(false);
    }
  };

  const handleSaveEdit = async (id: string, updates: Partial<Trigger>) => {
    await updateTrigger(id, updates);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      if (deleteModal.type === 'radar' && deleteModal.trigger) {
        await deleteTrigger(deleteModal.trigger.id);
        if (selectedTrigger?.id === deleteModal.trigger.id) {
          setSelectedTrigger(null);
        }
      } else if (deleteModal.type === 'clear_logs' && selectedTrigger) {
        await clearTriggerLogs(selectedTrigger.id);
      } else if (deleteModal.type === 'log' && selectedTrigger && deleteModal.logId) {
        await deleteTriggerLog(selectedTrigger.id, deleteModal.logId);
      }
      setDeleteModal({ open: false, type: 'radar' });
    } catch (err: any) {
      alert(err.message || 'Erro ao processar exclusão');
    } finally {
      setDeleting(false);
    }
  };

  const filteredTriggers = useMemo(() => {
    return filterTriggersByCategory(triggers, selectedCategory);
  }, [triggers, selectedCategory]);

  const activeTriggers = useMemo(() => filteredTriggers.filter((t) => t.status === 'active'), [filteredTriggers]);
  const pausedTriggers = useMemo(() => filteredTriggers.filter((t) => t.status !== 'active'), [filteredTriggers]);

  return (
    <div className="flex-1 h-screen flex flex-col bg-[#F8F9FA] dark:bg-[#0B0D10] text-zinc-900 dark:text-[#FAFAFA] overflow-hidden select-none transition-colors duration-200">
      {/* Top Header */}
      <header className="h-16 px-6 border-b border-zinc-200/80 dark:border-[#222730] flex items-center justify-between bg-white/80 dark:bg-[#14171C]/80 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-3">
          {selectedTrigger ? (
            <button
              onClick={() => setSelectedTrigger(null)}
              className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
              title="Voltar para todos os radares"
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Sparkles size={16} />
            </div>
          )}

          <div>
            <h2 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white leading-tight">
              {selectedTrigger ? selectedTrigger.title : 'Vigílias & Radares'}
            </h2>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 capitalize">
              {selectedTrigger
                ? `${selectedTrigger.category} • ${selectedTrigger.frequency || 'Diário às 08:30'}`
                : 'Monitoramento inteligente em segundo plano'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {selectedTrigger ? (
            <>
              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => handleToggleActive(selectedTrigger)}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                  selectedTrigger.status === 'active' ? 'bg-[#10B981]' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
                title={selectedTrigger.status === 'active' ? 'Pausar monitoramento' : 'Ativar monitoramento'}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    selectedTrigger.status === 'active' ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>

              {/* Menu More Options */}
              <div className="relative">
                <button
                  onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 rounded-full transition-colors"
                  title="Mais opções do radar"
                >
                  <MoreVertical size={18} />
                </button>

                {headerMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setHeaderMenuOpen(false)} />
                    <div className="absolute right-0 top-9 z-30 w-44 py-1.5 rounded-2xl bg-white dark:bg-[#1C2026] border border-zinc-200 dark:border-[#2A313C] shadow-xl text-xs font-semibold">
                      <button
                        onClick={() => {
                          setHeaderMenuOpen(false);
                          setEditTarget(selectedTrigger);
                        }}
                        className="w-full px-3.5 py-2 text-left flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                      >
                        <Edit3 size={14} />
                        <span>Editar Radar</span>
                      </button>
                      <button
                        onClick={() => {
                          setHeaderMenuOpen(false);
                          setDeleteModal({ open: true, type: 'clear_logs', trigger: selectedTrigger });
                        }}
                        className="w-full px-3.5 py-2 text-left flex items-center gap-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
                      >
                        <Clock size={14} />
                        <span>Limpar Histórico</span>
                      </button>
                      <button
                        onClick={() => {
                          setHeaderMenuOpen(false);
                          setDeleteModal({ open: true, type: 'radar', trigger: selectedTrigger });
                        }}
                        className="w-full px-3.5 py-2 text-left flex items-center gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                      >
                        <Trash2 size={14} />
                        <span>Excluir Radar</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-[#09090B] text-xs font-semibold shadow-xs transition-all"
            >
              <Plus size={14} />
              <span>+ Novo Radar</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-8 scroll-smooth">
        <div className="max-w-[1400px] mx-auto">
          {selectedTrigger ? (
            /* DETALHES DO RADAR SELECIONADO & RELATÓRIOS */
            <TriggerDetailView
              trigger={selectedTrigger}
              logs={logs}
              loadingLogs={loadingLogs}
              runningTest={runningTest}
              onRunVerifyNow={handleRunVerifyNow}
              onRequestDeleteLog={(logId) => {
                setDeleteModal({
                  open: true,
                  type: 'log',
                  trigger: selectedTrigger,
                  logId,
                });
              }}
              onRequestClearLogs={() => {
                setDeleteModal({
                  open: true,
                  type: 'clear_logs',
                  trigger: selectedTrigger,
                });
              }}
              onOpenChatWithPrompt={onOpenChatWithPrompt}
            />
          ) : (
            /* VISÃO GERAL DE RADARES (LISTAGEM & CATEGORIAS) */
            <div className="space-y-8">
              {/* Filtro de Categorias */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  const count =
                    cat.id === 'all'
                      ? triggers.length
                      : triggers.filter((t) => t.category.toLowerCase() === cat.id.toLowerCase()).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 ${
                        isSelected
                          ? 'bg-zinc-900 text-white dark:bg-white dark:text-[#09090B] shadow-xs'
                          : 'bg-white/80 dark:bg-[#14171C]/80 border border-zinc-200 dark:border-[#222730] text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
                      }`}
                    >
                      <span>{cat.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 dark:bg-black/20' : 'bg-zinc-100 dark:bg-[#0B0D10]'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {loading ? (
                <div className="p-16 text-center rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] flex flex-col items-center justify-center gap-3 text-zinc-400">
                  <Loader2 size={26} className="animate-spin text-zinc-600 dark:text-zinc-300" />
                  <p className="text-sm font-medium">Sincronizando vigílias com o app mobile...</p>
                </div>
              ) : triggers.length === 0 ? (
                /* Estado Vazio Real (Sem mock demo-1) */
                <div className="p-12 text-center rounded-[28px] bg-white dark:bg-[#14171C] border border-zinc-200 dark:border-[#222730] shadow-sm space-y-4 max-w-xl mx-auto">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Sparkles size={28} />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                      Nenhum radar cadastrado
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-md mx-auto">
                      Crie um radar para o Vito pesquisar novidades, vagas de emprego, concursos e oportunidades automaticamente em segundo plano.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => setCreateModalOpen(true)}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-[#09090B] text-xs sm:text-sm font-bold shadow-md transition-all"
                    >
                      <Plus size={16} />
                      <span>Criar Meu Primeiro Radar</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Radares Ativos */}
                  {activeTriggers.length > 0 && (
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs sm:text-sm font-bold text-zinc-500 uppercase tracking-wider">
                          Vigílias Ativas ({activeTriggers.length})
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {activeTriggers.map((tr) => (
                          <RadarCard
                            key={tr.id}
                            trigger={tr}
                            onSelect={(item) => setSelectedTrigger(item)}
                            onToggle={handleToggleActive}
                            onEdit={(item) => setEditTarget(item)}
                            onDelete={(item) => setDeleteModal({ open: true, type: 'radar', trigger: item })}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Radares Pausados */}
                  {pausedTriggers.length > 0 && (
                    <div className="space-y-3.5 pt-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs sm:text-sm font-bold text-zinc-400 uppercase tracking-wider">
                          Pausados ({pausedTriggers.length})
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 opacity-80">
                        {pausedTriggers.map((tr) => (
                          <RadarCard
                            key={tr.id}
                            trigger={tr}
                            onSelect={(item) => setSelectedTrigger(item)}
                            onToggle={handleToggleActive}
                            onEdit={(item) => setEditTarget(item)}
                            onDelete={(item) => setDeleteModal({ open: true, type: 'radar', trigger: item })}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modais */}
      <CreateTriggerModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={fetchTriggers}
      />

      <EditTriggerModal
        open={editTarget !== null}
        trigger={editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleSaveEdit}
        onDeleteRequest={(item) => {
          setDeleteModal({ open: true, type: 'radar', trigger: item });
        }}
      />

      <DeleteTriggerModal
        open={deleteModal.open}
        type={deleteModal.type}
        targetTitle={deleteModal.trigger?.title}
        loading={deleting}
        onClose={() => setDeleteModal({ open: false, type: 'radar' })}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
