import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { MemoriesResponse } from '../../services/api/memoriesApi';
import { Button } from '../ui/Button';

type MemTab = 'themes' | 'episodes' | 'facts';

export const MemoryPanel: React.FC = () => {
  const [data, setData] = useState<MemoriesResponse>({ themes: [], episodes: [], facts: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<MemTab>('themes');
  const [adding, setAdding] = useState(false);
  const [factCat, setFactCat] = useState('Preferência');
  const [factText, setFactText] = useState('');

  useEffect(() => {
    setLoading(true);
    api.memoriesApi
      .listMemories()
      .then((res) => setData(res || { themes: [], episodes: [], facts: [] }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSaveFact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factText.trim()) return;
    const newFact = {
      id: `f_${Date.now()}`,
      user_id: 'me',
      category: factCat.trim() || 'Preferência',
      content: factText.trim(),
      source: 'manual',
      confidence: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setData((prev) => ({ ...prev, facts: [newFact, ...prev.facts] }));
    setFactText('');
    setAdding(false);
    setTab('facts');
    await api.request('/api/v1/memories/facts', {
      method: 'POST',
      body: JSON.stringify({ category: newFact.category, content: newFact.content }),
    }).catch(() => {});
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Memória do Vito</h2>
          <p className="text-xs text-[var(--muted)]">O que o Vito sabe sobre mim</p>
        </div>
        <Button variant="pri" size="sm" pill onClick={() => setAdding((v) => !v)} leftIcon={<Plus size={14} />}>
          Novo fato
        </Button>
      </div>

      {adding && (
        <form onSubmit={handleSaveFact} className="p-4 rounded-2xl bg-[var(--bg)] border border-[var(--line)] space-y-2.5">
          <div className="flex gap-2">
            <input
              value={factCat}
              onChange={(e) => setFactCat(e.target.value)}
              placeholder="Categoria"
              className="w-40 h-9 px-3 rounded-xl border border-[var(--line)] bg-[var(--surf)] text-xs"
            />
            <input
              value={factText}
              onChange={(e) => setFactText(e.target.value)}
              placeholder="Ex.: Não marcar reuniões às sextas depois das 16h"
              className="flex-1 h-9 px-3 rounded-xl border border-[var(--line)] bg-[var(--surf)] text-xs"
            />
          </div>
          <Button variant="pri" size="sm" pill type="submit">
            Salvar na memória
          </Button>
        </form>
      )}

      <div className="flex rounded-full bg-[var(--bg)] p-1 border border-[var(--line)] w-fit">
        {(
          [
            ['themes', `Temas (${data.themes.length})`],
            ['episodes', `Episódios (${data.episodes.length})`],
            ['facts', `Fatos (${data.facts.length})`],
          ] as Array<[MemTab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-3.5 h-8 rounded-full text-xs font-semibold ${
              tab === id ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--muted)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-xs text-[var(--muted)]">Carregando memórias…</p>
      ) : tab === 'themes' ? (
        <div className="space-y-2.5">
          {data.themes.length === 0 && (
            <p className="text-xs text-[var(--muted)]">Nenhum resumo temático consolidado ainda.</p>
          )}
          {data.themes.map((t) => (
            <div key={t.id} className="p-4 rounded-2xl bg-[var(--bg)] border border-[var(--line)]">
              <div className="flex items-center justify-between">
                <b className="text-sm">{t.theme_title}</b>
                <button
                  type="button"
                  onClick={() => {
                    setData((p) => ({ ...p, themes: p.themes.filter((x) => x.theme_slug !== t.theme_slug) }));
                    api.memoriesApi.deleteThematicSummary(t.theme_slug).catch(() => {});
                  }}
                  className="text-[var(--muted)] hover:text-[var(--red)]"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <p className="text-xs text-[var(--muted)] mt-1">{t.consolidated_summary}</p>
            </div>
          ))}
        </div>
      ) : tab === 'episodes' ? (
        <div className="space-y-2.5">
          {data.episodes.length === 0 && (
            <p className="text-xs text-[var(--muted)]">Nenhum episódio registrado ainda.</p>
          )}
          {data.episodes.map((ep) => (
            <div key={ep.id} className="p-4 rounded-2xl bg-[var(--bg)] border border-[var(--line)]">
              <div className="flex items-center justify-between">
                <b className="text-sm">{ep.title}</b>
                <button
                  type="button"
                  onClick={() => {
                    setData((p) => ({ ...p, episodes: p.episodes.filter((x) => x.id !== ep.id) }));
                    api.memoriesApi.deleteEpisode(ep.id).catch(() => {});
                  }}
                  className="text-[var(--muted)] hover:text-[var(--red)]"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <p className="text-xs text-[var(--muted)] mt-1">{ep.narrative_summary}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {data.facts.length === 0 && (
            <p className="text-xs text-[var(--muted)]">Nenhum fato atômico aprendido ainda.</p>
          )}
          {data.facts.map((f) => (
            <div key={f.id} className="p-3.5 rounded-2xl bg-[var(--bg)] border border-[var(--line)] flex items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase text-[var(--blue)]">{f.category}</span>
                <b className="block text-sm font-medium">{f.content}</b>
              </div>
              <button
                type="button"
                onClick={() => {
                  setData((p) => ({ ...p, facts: p.facts.filter((x) => x.id !== f.id) }));
                  api.memoriesApi.deleteFact(f.id).catch(() => {});
                }}
                className="text-[var(--muted)] hover:text-[var(--red)]"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
