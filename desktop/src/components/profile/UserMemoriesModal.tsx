import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { MemoriesResponse } from '../../services/api/memoriesApi';
import { X, Trash2, Brain, Sparkles, BookOpen, Clock } from 'lucide-react';

interface UserMemoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserMemoriesModal: React.FC<UserMemoriesModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<MemoriesResponse>({ themes: [], episodes: [], facts: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'themes' | 'episodes' | 'facts'>('themes');

  const fetchMemories = async () => {
    setLoading(true);
    try {
      const res = await api.memoriesApi.listMemories();
      setData(res || { themes: [], episodes: [], facts: [] });
    } catch (err) {
      console.error('Falha ao buscar memórias:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMemories();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDeleteTheme = async (slug: string) => {
    try {
      await api.memoriesApi.deleteThematicSummary(slug);
      setData((prev) => ({
        ...prev,
        themes: prev.themes.filter((t) => t.theme_slug !== slug),
      }));
    } catch (err) {
      console.error('Erro ao deletar tema:', err);
    }
  };

  const handleDeleteEpisode = async (id: string) => {
    try {
      await api.memoriesApi.deleteEpisode(id);
      setData((prev) => ({
        ...prev,
        episodes: prev.episodes.filter((e) => e.id !== id),
      }));
    } catch (err) {
      console.error('Erro ao deletar episódio:', err);
    }
  };

  const handleDeleteFact = async (id: string) => {
    try {
      await api.memoriesApi.deleteFact(id);
      setData((prev) => ({
        ...prev,
        facts: prev.facts.filter((f) => f.id !== id),
      }));
    } catch (err) {
      console.error('Erro ao deletar fato:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-[#12151A] rounded-2xl border border-zinc-200 dark:border-[#222730] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-zinc-200 dark:border-[#222730] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Brain size={22} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                O que o Vito sabe sobre mim
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Transparência total sobre fatos, episódios e preferências aprendidas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-[#222730] px-5 gap-4">
          <button
            onClick={() => setActiveTab('themes')}
            className={`py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'themes'
                ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <Sparkles size={14} />
            Resumos Temáticos ({data.themes.length})
          </button>
          <button
            onClick={() => setActiveTab('episodes')}
            className={`py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'episodes'
                ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <Clock size={14} />
            Episódios Recentes ({data.episodes.length})
          </button>
          <button
            onClick={() => setActiveTab('facts')}
            className={`py-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'facts'
                ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <BookOpen size={14} />
            Fatos Atômicos ({data.facts.length})
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-400">Carregando memórias...</div>
          ) : (
            <>
              {activeTab === 'themes' && (
                <>
                  {data.themes.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-400">
                      Nenhum resumo temático consolidado ainda.
                    </div>
                  ) : (
                    data.themes.map((th) => (
                      <div
                        key={th.id}
                        className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex items-start justify-between gap-3"
                      >
                        <div>
                          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            {th.theme_title}
                          </div>
                          <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 whitespace-pre-wrap">
                            {th.consolidated_summary}
                          </p>
                          <div className="text-[10px] text-zinc-400 mt-2">
                            {th.fact_count} fatos · {th.episode_count} episódios consolidados
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteTheme(th.theme_slug)}
                          className="text-zinc-400 hover:text-red-500 p-1 transition-colors"
                          title="Esquecer este tema"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </>
              )}

              {activeTab === 'episodes' && (
                <>
                  {data.episodes.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-400">
                      Nenhum episódio registrado ainda.
                    </div>
                  ) : (
                    data.episodes.map((ep) => (
                      <div
                        key={ep.id}
                        className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex items-start justify-between gap-3"
                      >
                        <div>
                          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            {ep.title}
                          </div>
                          <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">
                            {ep.narrative_summary}
                          </p>
                          <div className="text-[10px] text-zinc-400 mt-2">
                            Canal: {ep.channel} · Importância: {ep.importance}/5
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteEpisode(ep.id)}
                          className="text-zinc-400 hover:text-red-500 p-1 transition-colors"
                          title="Esquecer este episódio"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </>
              )}

              {activeTab === 'facts' && (
                <>
                  {data.facts.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-400">
                      Nenhum fato atômico aprendido ainda.
                    </div>
                  ) : (
                    data.facts.map((fc) => (
                      <div
                        key={fc.id}
                        className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/40 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-purple-600 dark:text-purple-400 mr-2">
                            [{fc.category}]
                          </span>
                          <span className="text-xs text-zinc-800 dark:text-zinc-200">
                            {fc.content}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteFact(fc.id)}
                          className="text-zinc-400 hover:text-red-500 p-1 transition-colors shrink-0"
                          title="Esquecer este fato"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-[#222730] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
