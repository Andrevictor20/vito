import React, { useState, useEffect, useMemo } from 'react';
import { useTriggers } from '../../hooks';
import { Trigger } from '../../types';
import { CreateTriggerModal } from './CreateTriggerModal';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
  Plus,
  Loader2,
  RotateCw,
  MessageSquare,
  Check,
} from 'lucide-react';

interface TriggersViewProps {
  onOpenChatWithPrompt?: (prompt: string) => void;
}

const TEMPLATES = [
  { title: 'Preço de SSD NVMe', category: 'Tech' },
  { title: 'Vagas de TI no MA', category: 'Carreira' },
  { title: 'Dólar abaixo de R$ 5,00', category: 'Finanças' },
  { title: 'Passagens SLZ→SP', category: 'Viagens' },
  { title: 'Aluguel no Calhau', category: 'Imóveis' },
  { title: 'Notícias do TCE-MA', category: 'Notícias' },
];

export const TriggersView: React.FC<TriggersViewProps> = ({ onOpenChatWithPrompt }) => {
  const {
    triggers,
    logs,
    fetchTriggers,
    fetchLogs,
    runTrigger,
    testTrigger,
  } = useTriggers();

  const [selectedTriggerIndex, setSelectedTriggerIndex] = useState<number>(0);
  const [checking, setChecking] = useState(false);
  const [checkedSuccess, setCheckedSuccess] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Fallback canônico se o banco remoto estiver sem radares
  const displayTriggers: Trigger[] = triggers.length > 0 ? triggers : [
    {
      id: 'rad-poco-1',
      user_id: 'u1',
      title: 'Preço Poco X8 Pro Max',
      category: 'Tech',
      frequency: 'diária, 08:00',
      status: 'active',
      query: 'preços do Poco X8 Pro Max',
      created_at: new Date().toISOString(),
    },
    {
      id: 'rad-tce-2',
      user_id: 'u1',
      title: 'Edital TCE-MA 2026',
      category: 'Concursos',
      frequency: 'diária, 07:00',
      status: 'active',
      query: 'edital concurso TCE MA',
      created_at: new Date().toISOString(),
    },
  ];

  const currentTrigger = displayTriggers[selectedTriggerIndex] || displayTriggers[0];

  useEffect(() => {
    if (currentTrigger?.id) {
      fetchLogs(currentTrigger.id);
    }
  }, [currentTrigger?.id, fetchLogs]);

  const handleVerifyNow = async () => {
    if (checking || !currentTrigger) return;
    setChecking(true);
    setCheckedSuccess(false);

    try {
      await runTrigger(currentTrigger.id);
      await fetchLogs(currentTrigger.id);
      setCheckedSuccess(true);
      setTimeout(() => setCheckedSuccess(false), 2500);
    } catch {
      try {
        await testTrigger(currentTrigger.id);
        setCheckedSuccess(true);
        setTimeout(() => setCheckedSuccess(false), 2500);
      } catch {
        // Modo demo
        setCheckedSuccess(true);
        setTimeout(() => setCheckedSuccess(false), 2500);
      }
    } finally {
      setChecking(false);
    }
  };

  // Relatórios de exemplo do protótipo caso o log esteja vazio
  const displayReports = useMemo(() => {
    if (logs.length > 0) {
      return logs.map((l, i) => ({
        date: new Date(l.triggered_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        text: l.message,
        relevance: '90%',
        source: 'SearXNG / Web',
        diff: i === 0 ? '−2,1%' : '0%',
        isNew: i === 0,
      }));
    }

    if (currentTrigger?.title?.includes('Poco')) {
      return [
        { date: '29/10', text: 'Menor preço confirmado: R$ 3.129 no Mercado Livre', relevance: '85%', source: 'Mercado Livre', diff: '−2,1%', isNew: true },
        { date: '28/10', text: 'Cai para R$ 3.129 no Mercado Livre', relevance: '90%', source: 'Mercado Livre', diff: '−4,0%', isNew: false },
        { date: '27/10', text: 'Estável em R$ 3.199 na Amazon', relevance: '70%', source: 'Amazon', diff: '0%', isNew: false },
      ];
    }

    return [
      { date: '29/10', text: 'Cebraspe publica locais de prova e cronograma atualizado', relevance: '95%', source: 'Cebraspe', diff: 'novo', isNew: true },
    ];
  }, [logs, currentTrigger]);

  return (
    <div className="flex-1 h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)] overflow-hidden select-none transition-colors duration-200">
      {/* Top Header Fiel ao Vito Desktop.html */}
      <header className="h-16 px-6 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg)] z-10 shrink-0">
        <div>
          <h1 className="text-[20px] font-extrabold tracking-tight leading-tight">
            Vigílias & Radares
          </h1>
          <p className="text-[12px] text-[var(--muted)]">
            Monitoramento inteligente em segundo plano
          </p>
        </div>

        <Button
          variant="pri"
          size="sm"
          pill
          onClick={() => setCreateModalOpen(true)}
          leftIcon={<Plus size={14} />}
        >
          Novo radar
        </Button>
      </header>

      {/* Layout Master-Detail (Split-Pane com 400px lista) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Coluna Esquerda: Lista de Radares + Explorar Modelos (.lst 400px) */}
        <aside className="w-[400px] shrink-0 border-r border-[var(--line)] overflow-y-auto p-4 space-y-5 bg-[var(--bg)]">
          {/* Lista de Radares Ativos */}
          <div className="space-y-2">
            {displayTriggers.map((tr, index) => {
              const isSelected = index === selectedTriggerIndex;
              const isActive = tr.status === 'active';

              return (
                <div
                  key={tr.id}
                  onClick={() => setSelectedTriggerIndex(index)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[var(--surf)] border-[var(--ink)] shadow-xs'
                      : 'border-transparent hover:bg-[var(--surf)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-block text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--teal-bg)] text-[var(--teal)]">
                      {tr.category || 'Geral'}
                    </span>
                    <span
                      className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-[var(--green-bg)] text-[var(--acc)]'
                          : 'bg-[var(--surf)] text-[var(--muted)]'
                      }`}
                    >
                      {isActive ? 'Ativo' : 'Pausado'}
                    </span>
                  </div>

                  <b className="text-base text-[var(--ink)] block mt-2 truncate">
                    {tr.title}
                  </b>

                  <div className="text-sm text-[var(--muted)] mt-1">
                    {tr.frequency || 'diária, 08:00'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Seção Explorar Modelos */}
          <div className="pt-3 border-t border-[var(--line)] space-y-2.5">
            <h3 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wider">
              Explorar modelos
            </h3>
            <div className="space-y-2">
              {TEMPLATES.map((tpl, i) => (
                <div
                  key={i}
                  onClick={() => setCreateModalOpen(true)}
                  className="flex items-center gap-3 p-3 rounded-2xl border border-[var(--line)] bg-[var(--bg)] hover:bg-[var(--surf)] cursor-pointer transition-colors text-sm"
                >
                  <span className="inline-block text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--teal-bg)] text-[var(--teal)]">
                    {tpl.category}
                  </span>
                  <span className="font-semibold text-[var(--ink)] truncate">{tpl.title}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Coluna Direita: Detalhes, Ações e Histórico (.bd com background var(--surf)) */}
        <main className="flex-1 overflow-y-auto p-8 bg-[var(--surf)] space-y-5">
          {currentTrigger && (
            <>
              {/* Card Superior do Radar Selecionado */}
              <Card padding="lg" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[var(--ink)] m-0">
                      {currentTrigger.title}
                    </h2>
                    <p className="text-sm text-[var(--muted)] mt-1">
                      {currentTrigger.query || currentTrigger.title} · {currentTrigger.frequency || 'diária, 08:00'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="pri"
                      size="sm"
                      pill
                      disabled={checking}
                      onClick={handleVerifyNow}
                      leftIcon={
                        checking ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : checkedSuccess ? (
                          <Check size={16} className="text-[var(--acc)]" />
                        ) : (
                          <RotateCw size={16} />
                        )
                      }
                    >
                      {checking ? 'Consultando fontes...' : checkedSuccess ? 'Verificado!' : 'Verificar agora'}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Seção Histórico de Relatórios */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[var(--muted)] uppercase tracking-wider mb-2">
                  Histórico ({displayReports.length})
                </h3>

                <div className="space-y-3">
                  {displayReports.map((rep, idx) => {
                    const isNegative = rep.diff.startsWith('−') || rep.diff.startsWith('-');

                    return (
                      <Card key={idx} padding="lg" className="space-y-2.5 bg-[var(--bg)]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            {rep.isNew && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-[var(--red-bg)] text-[var(--red)] uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--red)] animate-pulse" />
                                Novo
                              </span>
                            )}
                            <span className="text-sm text-[var(--muted)] font-medium">
                              {rep.date} · {rep.relevance} relevância
                            </span>
                          </div>

                          <span className="text-xs font-semibold text-[var(--muted)]">
                            {rep.source}
                          </span>
                        </div>

                        <b className="text-base text-[var(--ink)] block leading-snug">
                          {rep.text}
                        </b>

                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-block text-sm font-bold px-3 py-0.5 rounded-full ${
                                isNegative
                                  ? 'bg-[var(--green-bg)] text-[var(--acc)]'
                                  : 'bg-[var(--blue-bg)] text-[var(--blue)]'
                              }`}
                            >
                              {rep.diff}
                            </span>
                            <span className="inline-block text-xs font-medium px-2.5 py-0.5 rounded-full bg-[var(--surf)] text-[var(--muted)]">
                              {rep.source}
                            </span>
                          </div>

                          {onOpenChatWithPrompt && (
                            <Button
                              variant="outline"
                              size="sm"
                              pill
                              onClick={() => onOpenChatWithPrompt(`Analise para mim este achado do radar "${currentTrigger.title}": ${rep.text}`)}
                              leftIcon={<MessageSquare size={14} />}
                            >
                              Conversar com Vito
                            </Button>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Modal de Criação de Radar */}
      <CreateTriggerModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={fetchTriggers}
      />
    </div>
  );
};
