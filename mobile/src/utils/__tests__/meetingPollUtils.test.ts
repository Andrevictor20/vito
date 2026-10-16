import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toggleMeetingSlotSelection,
  formatSlotBRTDisplay,
  computeBookingTabCounts,
  extractMeetingVotesActivity,
  slotsFromMeetingDetails,
  computeSlotVotePercentage,
} from '../meetingPollUtils';
import { Meeting } from '../../types';

test('toggleMeetingSlotSelection adiciona e remove slots com 1 toque mantendo ordenação', () => {
  const initial = [{ date: '2026-10-19', time: '18:00' }];
  // Tocar num novo horário adiciona
  const afterAdd = toggleMeetingSlotSelection(initial, '2026-10-19', '14:00');
  assert.equal(afterAdd.length, 2);
  assert.deepEqual(afterAdd[0], { date: '2026-10-19', time: '14:00' });
  assert.deepEqual(afterAdd[1], { date: '2026-10-19', time: '18:00' });

  // Tocar novamente no mesmo horário remove (toggle off)
  const afterRemove = toggleMeetingSlotSelection(afterAdd, '2026-10-19', '14:00');
  assert.equal(afterRemove.length, 1);
  assert.deepEqual(afterRemove[0], { date: '2026-10-19', time: '18:00' });
});

test('formatSlotBRTDisplay converte ISO UTC para fuso de Brasília (-03:00) e dia em português', () => {
  // 2026-10-19T21:00:00Z = Segunda-feira 19/10 às 18:00 BRT
  const formatted = formatSlotBRTDisplay('2026-10-19T21:00:00Z', '2026-10-19T21:30:00Z');
  assert.equal(formatted.dateLabel, '19/10 (Seg)');
  assert.equal(formatted.timeRange, '18:00 – 18:30');
  assert.equal(formatted.startTime, '18:00');
  assert.equal(formatted.dateKey, '2026-10-19');
});

test('computeBookingTabCounts soma links 1-on-1 + reuniões em grupo e agendamentos + votos recebidos', () => {
  const meetings: Meeting[] = [
    {
      id: 'm1',
      user_id: 'u1',
      title: 'Reunião design vito',
      duration_minutes: 30,
      mode: 'group_consensus',
      status: 'open',
      expires_at: '2026-10-25T00:00:00Z',
      created_at: '2026-10-16T00:00:00Z',
      updated_at: '2026-10-16T00:00:00Z',
      participants: [
        {
          id: 'p1',
          meeting_id: 'm1',
          name: 'Ana Silva',
          voted_slot_ids: ['s1'],
          responded_at: '2026-10-16T19:00:00Z',
          created_at: '2026-10-16T19:00:00Z',
        },
        {
          id: 'p2',
          meeting_id: 'm1',
          name: 'Carlos',
          voted_slot_ids: ['s1', 's2'],
          responded_at: '2026-10-16T19:05:00Z',
          created_at: '2026-10-16T19:05:00Z',
        },
      ],
    },
  ];

  const counts = computeBookingTabCounts(0, meetings, 0);
  assert.equal(counts.linksCount, 1);
  assert.equal(counts.receivedCount, 2);
});

test('extractMeetingVotesActivity extrai respostas de participantes com os horários votados em BRT', () => {
  const meetings: Meeting[] = [
    {
      id: 'm1',
      user_id: 'u1',
      title: 'Reunião design vito',
      duration_minutes: 30,
      mode: 'group_consensus',
      status: 'open',
      expires_at: '2026-10-25T00:00:00Z',
      created_at: '2026-10-16T00:00:00Z',
      updated_at: '2026-10-16T00:00:00Z',
      slots: [
        {
          id: 's1',
          meeting_id: 'm1',
          start_at: '2026-10-19T21:00:00Z',
          end_at: '2026-10-19T21:30:00Z',
          votes_count: 1,
          voter_names: ['Ana Silva'],
          is_winner: true,
          created_at: '2026-10-16T00:00:00Z',
        },
      ],
      participants: [
        {
          id: 'p1',
          meeting_id: 'm1',
          name: 'Ana Silva',
          contact_info: '11999999999',
          voted_slot_ids: ['s1'],
          responded_at: '2026-10-16T19:00:00Z',
          created_at: '2026-10-16T19:00:00Z',
        },
      ],
    },
  ];

  const activity = extractMeetingVotesActivity(meetings);
  assert.equal(activity.length, 1);
  assert.equal(activity[0].participantName, 'Ana Silva');
  assert.equal(activity[0].meetingTitle, 'Reunião design vito');
  assert.deepEqual(activity[0].votedLabels, ['19/10 (Seg) • 18:00']);
});

test('slotsFromMeetingDetails converte slots UTC da reunião de volta para pares {date, time} em BRT para edição', () => {
  const slots = slotsFromMeetingDetails([
    {
      id: 's1',
      meeting_id: 'm1',
      start_at: '2026-10-19T21:00:00Z',
      end_at: '2026-10-19T21:30:00Z',
      votes_count: 2,
      created_at: '2026-10-16T00:00:00Z',
    },
  ]);
  assert.deepEqual(slots, [{ date: '2026-10-19', time: '18:00' }]);
});

test('computeSlotVotePercentage calcula percentuais com arredondamento e bounds seguros', () => {
  assert.equal(computeSlotVotePercentage(0, 0), 0);
  assert.equal(computeSlotVotePercentage(2, 0), 0);
  assert.equal(computeSlotVotePercentage(1, 3), 33);
  assert.equal(computeSlotVotePercentage(2, 3), 67);
  assert.equal(computeSlotVotePercentage(3, 3), 100);
});

