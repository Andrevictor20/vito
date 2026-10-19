import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  filterAgendaEvents,
  countActiveAgendaFilters,
  matchesAgendaPeriod,
  matchesAgendaCategory,
  matchesAgendaSource,
  matchesAgendaFormat,
  DEFAULT_AGENDA_FILTER,
  AgendaFilterState,
} from './agendaFilter';
import type { Event } from '../types';

const mockEvents: Event[] = [
  {
    id: '1',
    user_id: 'u1',
    title: 'Reunião de Planejamento',
    start_at: '2026-10-19T14:00:00Z',
    end_at: '2026-10-19T15:00:00Z',
    category: 'work',
    source: 'google',
    created_at: '2026-10-01T00:00:00Z',
  },
  {
    id: '2',
    user_id: 'u1',
    title: 'Aula de Inglês',
    start_at: '2026-10-20T10:00:00Z',
    end_at: '2026-10-20T11:00:00Z',
    category: 'study',
    source: 'local',
    is_recurring: true,
    created_at: '2026-10-01T00:00:00Z',
  },
  {
    id: '3',
    user_id: 'u1',
    title: 'Finados',
    start_at: '2026-11-02T00:00:00Z',
    end_at: '2026-11-02T23:59:59Z',
    category: 'holiday',
    source: 'google',
    created_at: '2026-10-01T00:00:00Z',
  },
  {
    id: '4',
    user_id: 'u1',
    title: 'Consulta Médica Dermatologista',
    start_at: '2026-10-25T16:00:00Z',
    end_at: '2026-10-25T17:00:00Z',
    category: 'health',
    location: 'Hospital Albert Einstein',
    source: 'local',
    created_at: '2026-10-01T00:00:00Z',
  },
  {
    id: '5',
    user_id: 'u1',
    title: 'Reunião passada ontem',
    start_at: '2026-10-18T10:00:00Z',
    end_at: '2026-10-18T11:00:00Z',
    category: 'work',
    source: 'local',
    created_at: '2026-10-01T00:00:00Z',
  },
];

const referenceDate = new Date('2026-10-19T12:00:00Z');

describe('agendaFilter', () => {
  it('retorna todos os eventos quando nenhum filtro está ativo', () => {
    const res = filterAgendaEvents(mockEvents, DEFAULT_AGENDA_FILTER, referenceDate);
    assert.equal(res.length, 5);
  });

  it('filtra por busca textual no título e na localização', () => {
    const filterTitle: AgendaFilterState = { ...DEFAULT_AGENDA_FILTER, query: 'inglês' };
    const resTitle = filterAgendaEvents(mockEvents, filterTitle, referenceDate);
    assert.equal(resTitle.length, 1);
    assert.equal(resTitle[0].id, '2');

    const filterLoc: AgendaFilterState = { ...DEFAULT_AGENDA_FILTER, query: 'einstein' };
    const resLoc = filterAgendaEvents(mockEvents, filterLoc, referenceDate);
    assert.equal(resLoc.length, 1);
    assert.equal(resLoc[0].id, '4');
  });

  it('filtra por período: hoje, amanhã, 7 dias, este mês, passados', () => {
    const filterToday: AgendaFilterState = { ...DEFAULT_AGENDA_FILTER, period: 'today' };
    const resToday = filterAgendaEvents(mockEvents, filterToday, referenceDate);
    assert.equal(resToday.length, 1);
    assert.equal(resToday[0].id, '1');

    const filterTomorrow: AgendaFilterState = { ...DEFAULT_AGENDA_FILTER, period: 'tomorrow' };
    const resTomorrow = filterAgendaEvents(mockEvents, filterTomorrow, referenceDate);
    assert.equal(resTomorrow.length, 1);
    assert.equal(resTomorrow[0].id, '2');

    const filterWeek: AgendaFilterState = { ...DEFAULT_AGENDA_FILTER, period: 'week' };
    const resWeek = filterAgendaEvents(mockEvents, filterWeek, referenceDate);
    // 19/10, 20/10, 25/10 estão dentro de 7 dias
    assert.equal(resWeek.length, 3);

    const filterPast: AgendaFilterState = { ...DEFAULT_AGENDA_FILTER, period: 'past' };
    const resPast = filterAgendaEvents(mockEvents, filterPast, referenceDate);
    assert.equal(resPast.length, 1);
    assert.equal(resPast[0].id, '5');
  });

  it('filtra por origem (source: google vs local)', () => {
    const filterGoogle: AgendaFilterState = { ...DEFAULT_AGENDA_FILTER, source: 'google' };
    const resGoogle = filterAgendaEvents(mockEvents, filterGoogle, referenceDate);
    assert.equal(resGoogle.length, 2); // 1 e 3

    const filterLocal: AgendaFilterState = { ...DEFAULT_AGENDA_FILTER, source: 'local' };
    const resLocal = filterAgendaEvents(mockEvents, filterLocal, referenceDate);
    assert.equal(resLocal.length, 3); // 2, 4 e 5
  });

  it('filtra por categoria (work, study, holiday, health)', () => {
    const filterStudy: AgendaFilterState = { ...DEFAULT_AGENDA_FILTER, category: 'study' };
    const resStudy = filterAgendaEvents(mockEvents, filterStudy, referenceDate);
    assert.equal(resStudy.length, 1);
    assert.equal(resStudy[0].id, '2');

    const filterHoliday: AgendaFilterState = { ...DEFAULT_AGENDA_FILTER, category: 'holiday' };
    const resHoliday = filterAgendaEvents(mockEvents, filterHoliday, referenceDate);
    assert.equal(resHoliday.length, 1);
    assert.equal(resHoliday[0].id, '3');
  });

  it('filtra por formato (com horário, dia inteiro, recorrente)', () => {
    const filterRec: AgendaFilterState = { ...DEFAULT_AGENDA_FILTER, format: 'recurring' };
    const resRec = filterAgendaEvents(mockEvents, filterRec, referenceDate);
    assert.equal(resRec.length, 1);
    assert.equal(resRec[0].id, '2');

    const filterAllDay: AgendaFilterState = { ...DEFAULT_AGENDA_FILTER, format: 'allday' };
    const resAllDay = filterAgendaEvents(mockEvents, filterAllDay, referenceDate);
    assert.equal(resAllDay.length, 1);
    assert.equal(resAllDay[0].id, '3');
  });

  it('calcula a contagem de filtros ativos corretamente', () => {
    assert.equal(countActiveAgendaFilters(DEFAULT_AGENDA_FILTER), 0);

    const twoActive: AgendaFilterState = {
      ...DEFAULT_AGENDA_FILTER,
      period: 'week',
      source: 'google',
    };
    assert.equal(countActiveAgendaFilters(twoActive), 2);
  });
});
