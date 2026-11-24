import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { CalendarEvent, Todo } from '../../types';
import { calculateWeeklySummaries } from '../../utils/weeklySummaryCalculator';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';

interface ExecutiveSummariesViewProps {
  onBack?: () => void;
  onOpenChatWithPrompt?: (prompt: string) => void;
}

type Horizon = 'daily' | 'weekly' | 'monthly';

export const ExecutiveSummariesView: React.FC<ExecutiveSummariesViewProps> = ({
  onBack,
  onOpenChatWithPrompt,
}) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [horizon, setHorizon] = useState<Horizon>('daily');
  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(3);
  const [activeDrawer, setActiveDrawer] = useState<'weekly' | 'monthly' | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [evs, tds] = await Promise.all([api.getEvents(), api.getTodos()]);
        setEvents(evs || []);
        setTodos(tds || []);
      } catch (err) {
        console.error('Erro ao buscar resumos:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const weeklySummaries = useMemo(
    () => calculateWeeklySummaries(events, todos, 4),
    [events, todos]
  );
  const chronologicalWeeks = useMemo(
    () => [...weeklySummaries].reverse(),
    [weeklySummaries]
  );

  const activeWeek = chronologicalWeeks[selectedWeekIdx] || weeklySummaries[0];
  const maxWeekH = Math.max(1, ...chronologicalWeeks.map((w) => w.hours || 0));
  const avgWeekH =
    chronologicalWeeks.length > 0
      ? chronologicalWeeks.reduce((s, w) => s + (w.hours || 0), 0) / chronologicalWeeks.length
      : 0;

  const todayMetrics = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayEvents = events.filter((e) => e.start_at.startsWith(todayStr));
    const todayTodos = todos.filter((t) => !t.due_date || t.due_date.startsWith(todayStr));
    const completedTodos = todayTodos.filter((t) => t.status === 'completed');

    let totalMinutes = 0;
    todayEvents.forEach((e) => {
      const s = new Date(e.start_at).getTime();
      const end = new Date(e.end_at).getTime();
      if (end > s) totalMinutes += Math.round((end - s) / (1000 * 60));
    });

    const committed = Number((totalMinutes / 60).toFixed(1));
    const free = Math.max(0, Number((12 - committed).toFixed(1)));
    const freePct = Math.min(100, Math.round((free / 12) * 100));
    const now = new Date();
    const min = Math.max(480, Math.min(1200, now.getHours() * 60 + now.getMinutes()));
    const nowPct = Math.round(((min - 480) / 720) * 100);

    return {
      freeHours: free.toFixed(1),
      committedHours: committed.toFixed(1),
      freePct,
      nowPct,
      eventsCount: todayEvents.length,
      todosCount: todayTodos.length,
      completedTodos: completedTodos.length,
    };
  }, [events, todos]);

  const monthlyMetrics = useMemo(() => {
    const totalHours = chronologicalWeeks.reduce((s, w) => s + (w.hours || 0), 0);
    const totalEvents = chronologicalWeeks.reduce((s, w) => s + (w.eventsCount || 0), 0);
    const completed = todos.filter((t) => t.status === 'completed').length;
    const rate = todos.length > 0 ? Math.round((completed / todos.length) * 100) : 68;
    const workRatio = 28;
    const personalRatio = 72;

    const pts = chronologicalWeeks.map((w, k) => [
      24 + k * (252 / Math.max(1, chronologicalWeeks.length - 1)),
      96 - ((w.hours || 0) / maxWeekH) * 70,
    ]);
    let line = pts.length > 0 ? `M${pts[0][0]} ${pts[0][1]}` : 'M24 96';
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1];
      const b = pts[k];
      const mid = (a[0] + b[0]) / 2;
      line += ` C${mid} ${a[1]} ${mid} ${b[1]} ${b[0]} ${b[1]}`;
    }
    const area =
      pts.length > 0
        ? `${line} L${pts[pts.length - 1][0]} 106 L${pts[0][0]} 106Z`
        : `${line} L276 106 L24 106Z`;

    return { totalHours: totalHours.toFixed(1), totalEvents, rate, workRatio, personalRatio, pts, line, area };
  }, [chronologicalWeeks, maxWeekH, todos]);

  const dateHeading = useMemo(() => {
    const d = new Date();
    const dayNames = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    const monthNames = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
    ];
    return { day: d.getDate(), dayName: dayNames[d.getDay()], monthName: monthNames[d.getMonth()] };
  }, []);

  return (
    <div className="flex-1 h-screen flex flex-col bg-[var(--bg)] text-[var(--ink)] overflow-hidden select-none">
      <header className="h-16 px-6 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg)] shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-full text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surf)]"
              title="Voltar"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <h1 className="text-[20px] font-extrabold tracking-tight leading-tight">Resumos</h1>
            <p className="text-[12px] text-[var(--muted)]">Visão diária, semanal e mensal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-full bg-[var(--surf)] p-1 border border-[var(--line)]">
            {([
              ['daily', 'Diário'],
              ['weekly', 'Semanal'],
              ['monthly', 'Mensal'],
            ] as Array<[Horizon, string]>).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setHorizon(id)}
                className={`px-3.5 h-8 rounded-full text-xs font-semibold transition-colors ${
                  horizon === id ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--muted)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {onOpenChatWithPrompt && (
            <Button
              variant="outline"
              size="sm"
              pill
              onClick={() => onOpenChatWithPrompt('Gere uma síntese executiva do meu dia e prioridades')}
              leftIcon={<Sparkles size={14} className="text-[var(--purple)]" />}
            >
              Sintetizar com IA
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-auto p-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-[var(--muted)]">
            <Loader2 size={28} className="animate-spin text-[var(--blue)]" />
            <span className="text-sm font-medium">Consolidando resumos executivos...</span>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            {horizon === 'daily' && (
              <>
                <div className="rounded-[24px] p-6 border border-[var(--line)] bg-gradient-to-br from-[var(--blue-bg)] via-[var(--purple-bg)] to-[var(--bg)]">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Hoje · {dateHeading.dayName}, {dateHeading.day} de {dateHeading.monthName}
                  </div>
                  <div className="flex items-center gap-6 mt-4">
                    <div className="relative w-24 h-24 shrink-0">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--line)" strokeWidth="10" />
                        <circle
                          cx="50"
                          cy="50"
                          r="42"
                          fill="none"
                          stroke="var(--acc)"
                          strokeWidth="10"
                          strokeLinecap="round"
                          pathLength={100}
                          strokeDasharray={`${todayMetrics.freePct} 100`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <b className="text-xl font-semibold tabular-nums">{todayMetrics.freePct}%</b>
                        <small className="text-[11px] text-[var(--muted)]">livre</small>
                      </div>
                    </div>
                    <div>
                      <div className="text-4xl font-semibold tracking-tight tabular-nums">
                        {todayMetrics.freeHours}
                        <span className="text-base font-medium text-[var(--muted)] ml-1">h livres</span>
                      </div>
                      <p className="text-sm text-[var(--muted)] mt-1 tabular-nums">
                        <strong className="text-[var(--ink)]">{todayMetrics.committedHours}h</strong> comprometida
                      </p>
                      <span className="inline-block mt-2.5 px-3 py-1 rounded-xl text-xs font-semibold bg-[var(--green-bg)] text-[var(--acc)]">
                        Dia leve
                      </span>
                    </div>
                  </div>
                </div>

                {/* Linha do dia .rs-tl com indicador Agora pulsante */}
                <div className="rounded-[24px] p-5 bg-[var(--surf)] border border-[var(--line)]">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Linha do dia
                  </div>
                  <div className="relative mt-4 h-5 flex items-center">
                    <div className="w-full h-4 rounded-lg bg-[var(--green-bg)] overflow-hidden flex gap-1">
                      <div className="flex-1 bg-[var(--green-bg)]" />
                      {Number(todayMetrics.committedHours) > 0 && (
                        <div className="w-16 bg-[var(--blue)] rounded-md" />
                      )}
                      <div className="flex-[2] bg-[var(--green-bg)]" />
                    </div>
                    <span
                      className="absolute top-0 w-1 h-6 rounded bg-[var(--red)] animate-pulse"
                      style={{ left: `${todayMetrics.nowPct}%` }}
                      title="Agora"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-[var(--muted)] mt-2 tabular-nums">
                    <span>08:00</span>
                    <span className="text-[var(--red)] font-semibold">Agora</span>
                    <span>20:00</span>
                  </div>
                </div>
              </>
            )}

            {horizon === 'weekly' && activeWeek && (
              <>
                <div className="rounded-[24px] p-6 border border-[var(--line)] bg-gradient-to-br from-[var(--blue-bg)] via-[var(--purple-bg)] to-[var(--bg)]">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Horas em compromissos
                  </div>
                  <div className="text-4xl font-semibold tracking-tight mt-2 tabular-nums">
                    {activeWeek.hours.toFixed(1).replace('.', ',')}
                    <span className="text-base font-medium text-[var(--muted)] ml-1.5">h · {activeWeek.period}</span>
                  </div>

                  {/* Barras semanais interativas + linha tracejada média */}
                  <div className="relative mt-6 pt-4">
                    <div
                      className="absolute left-0 right-0 border-t border-dashed border-[var(--muted)] pointer-events-none"
                      style={{ bottom: `${Math.round((avgWeekH / maxWeekH) * 90) + 24}px` }}
                    >
                      <span className="absolute right-0 -top-4 text-[10.5px] text-[var(--muted)]">média</span>
                    </div>
                    <div className="flex items-end gap-3 h-32">
                      {chronologicalWeeks.map((w, idx) => {
                        const active = idx === selectedWeekIdx;
                        const hPct = Math.max(8, Math.round(((w.hours || 0) / maxWeekH) * 90));
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => setSelectedWeekIdx(idx)}
                            className="flex-1 h-full flex flex-col justify-end items-center gap-1.5"
                          >
                            <span className="text-xs font-medium tabular-nums">
                              {w.hours.toFixed(1).replace('.', ',')}h
                            </span>
                            <div
                              className={`w-full max-w-[54px] rounded-t-xl rounded-b-md transition-all ${
                                active ? 'bg-[var(--blue)]' : 'bg-[var(--line)]'
                              }`}
                              style={{ height: `${hPct}%` }}
                            />
                            <span className={`text-[11px] ${active ? 'font-semibold text-[var(--ink)]' : 'text-[var(--muted)]'}`}>
                              {w.period.split(' ')[0]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <Button variant="outline" size="md" pill onClick={() => setActiveDrawer('weekly')}>
                  Abrir Raio-X semanal
                </Button>
              </>
            )}

            {horizon === 'monthly' && (
              <>
                <div className="rounded-[24px] p-6 border border-[var(--line)] bg-gradient-to-br from-[var(--blue-bg)] via-[var(--purple-bg)] to-[var(--bg)] flex items-center gap-6">
                  <div className="relative w-24 h-24 shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="38" fill="none" stroke="var(--acc)" strokeWidth="16" pathLength={100} strokeDasharray={`${monthlyMetrics.personalRatio} 100`} />
                      <circle cx="50" cy="50" r="38" fill="none" stroke="var(--ink)" strokeWidth="16" pathLength={100} strokeDasharray={`${monthlyMetrics.workRatio} 100`} strokeDashoffset={-monthlyMetrics.personalRatio} />
                    </svg>
                    <div className="absolute inset-0 grid place-items-center text-lg font-semibold tabular-nums">
                      {monthlyMetrics.personalRatio}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                      {dateHeading.monthName} · eficácia {monthlyMetrics.rate}%
                    </div>
                    <div className="text-4xl font-semibold mt-1 tabular-nums">
                      {monthlyMetrics.totalHours}h
                    </div>
                    <p className="text-xs text-[var(--muted)] mt-1">
                      Trabalho {monthlyMetrics.workRatio}% · Pessoal {monthlyMetrics.personalRatio}%
                    </p>
                  </div>
                </div>

                {/* Curva Bézier mensal .rs-ln */}
                <div className="rounded-[24px] p-5 bg-[var(--surf)] border border-[var(--line)]">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
                    Tendência semanal
                  </div>
                  <svg className="w-full h-36 overflow-visible" viewBox="0 0 300 130">
                    <defs>
                      <linearGradient id="rsgDesk" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--blue)" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={monthlyMetrics.area} fill="url(#rsgDesk)" />
                    <path d={monthlyMetrics.line} fill="none" stroke="var(--blue)" strokeWidth="3" strokeLinecap="round" />
                    {monthlyMetrics.pts.map((p, k) => (
                      <g key={k}>
                        <circle cx={p[0]} cy={p[1]} r="5" fill="var(--bg)" stroke="var(--blue)" strokeWidth="2.5" />
                        <text x={p[0]} y={p[1] - 12} textAnchor="middle" fontSize="11" fill="var(--muted)">
                          {chronologicalWeeks[k]?.hours.toFixed(1).replace('.', ',')}h
                        </text>
                        <text x={p[0]} y="124" textAnchor="middle" fontSize="11" fill="var(--muted)">
                          {chronologicalWeeks[k]?.period.split(' ')[0]}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>

                <Button variant="outline" size="md" pill onClick={() => setActiveDrawer('monthly')}>
                  Abrir Raio-X mensal
                </Button>
              </>
            )}
          </div>
        )}
      </main>

      <Drawer
        open={activeDrawer === 'weekly'}
        onClose={() => setActiveDrawer(null)}
        title={`Raio-X · ${activeWeek?.period || ''}`}
        subtitle={`${activeWeek?.hours.toFixed(1).replace('.', ',') || '0'}h reais`}
      >
        <p className="text-sm leading-relaxed">{activeWeek?.narrative}</p>
      </Drawer>

      <Drawer
        open={activeDrawer === 'monthly'}
        onClose={() => setActiveDrawer(null)}
        title="Raio-X mensal"
        subtitle={`${dateHeading.monthName} · ${monthlyMetrics.totalHours}h reais`}
      >
        <p className="text-sm leading-relaxed">
          Neste ciclo você registrou {monthlyMetrics.totalHours}h em {monthlyMetrics.totalEvents} eventos, com {monthlyMetrics.personalRatio}% pessoal e {monthlyMetrics.workRatio}% trabalho.
        </p>
      </Drawer>
    </div>
  );
};
