import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toggleMeetingSlotSelection,
  formatSlotBRTDisplay,
  computeBookingTabCounts,
  extractMeetingVotesActivity,
  extractGroupedMeetingPolls,
  slotsFromMeetingDetails,
  computeSlotVotePercentage,
  getLeadingSlot,
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

test('computeBookingTabCounts soma links e conta reuniões em grupo ativas consolidadas', () => {
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
  assert.equal(counts.receivedCount, 1);
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

test('getLeadingSlot identifica o horário mais votado e calcula porcentagem e nomes', () => {
  const slots = [
    {
      id: 's1',
      meeting_id: 'm1',
      start_at: '2026-10-17T21:00:00Z',
      end_at: '2026-10-17T21:30:00Z',
      votes_count: 3,
      voter_names: ['André', 'Carlos', 'Beatriz'],
      is_winner: true,
      created_at: '2026-10-16T00:00:00Z',
    },
    {
      id: 's2',
      meeting_id: 'm1',
      start_at: '2026-10-18T21:00:00Z',
      end_at: '2026-10-18T21:30:00Z',
      votes_count: 1,
      voter_names: ['André'],
      is_winner: false,
      created_at: '2026-10-16T00:00:00Z',
    },
  ];

  const leading = getLeadingSlot(slots, 3);
  assert.equal(leading.slot?.id, 's1');
  assert.equal(leading.votesCount, 3);
  assert.equal(leading.percentage, 100);
  assert.deepEqual(leading.voterNames, ['André', 'Carlos', 'Beatriz']);
  assert.equal(leading.formatted?.dateLabel, '17/10 (Sáb)');
  assert.equal(leading.formatted?.timeRange, '18:00 – 18:30');

  // Caso vazio
  const empty = getLeadingSlot([], 0);
  assert.equal(empty.votesCount, 0);
  assert.equal(empty.slot, undefined);
});

test('extractGroupedMeetingPolls condensa múltiplos participantes em um único item por reunião com líder', () => {
  const meetings: Meeting[] = [
    {
      id: 'm1',
      user_id: 'u1',
      title: 'Reunião desenvolvimento app vito',
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
          start_at: '2026-10-17T21:00:00Z',
          end_at: '2026-10-17T21:30:00Z',
          votes_count: 2,
          voter_names: ['Ana Silva', 'André'],
          is_winner: true,
          created_at: '2026-10-16T00:00:00Z',
        },
        {
          id: 's2',
          meeting_id: 'm1',
          start_at: '2026-10-18T21:00:00Z',
          end_at: '2026-10-18T21:30:00Z',
          votes_count: 1,
          voter_names: ['Jéssica'],
          is_winner: false,
          created_at: '2026-10-16T00:00:00Z',
        },
      ],
      participants: [
        {
          id: 'p1',
          meeting_id: 'm1',
          name: 'Ana Silva',
          contact_info: 'ana@email.com',
          voted_slot_ids: ['s1'],
          responded_at: '2026-10-16T19:00:00Z',
          created_at: '2026-10-16T19:00:00Z',
        },
        {
          id: 'p2',
          meeting_id: 'm1',
          name: 'Jéssica',
          contact_info: 'jessica@gmail.com',
          voted_slot_ids: ['s2'],
          responded_at: '2026-10-16T19:02:00Z',
          created_at: '2026-10-16T19:02:00Z',
        },
        {
          id: 'p3',
          meeting_id: 'm1',
          name: 'André',
          contact_info: 'victorandre280@gmail.com',
          voted_slot_ids: ['s1'],
          responded_at: '2026-10-16T19:05:00Z',
          created_at: '2026-10-16T19:05:00Z',
        },
      ],
    },
    // Reunião sem votos não deve aparecer em Recebidos
    {
      id: 'm2',
      user_id: 'u1',
      title: 'Reunião Vazia',
      duration_minutes: 30,
      mode: 'group_consensus',
      status: 'open',
      expires_at: '2026-10-25T00:00:00Z',
      created_at: '2026-10-16T00:00:00Z',
      updated_at: '2026-10-16T00:00:00Z',
      participants: [],
      slots: [],
    },
  ];

  const grouped = extractGroupedMeetingPolls(meetings);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].meetingId, 'm1');
  assert.equal(grouped[0].meetingTitle, 'Reunião desenvolvimento app vito');
  assert.equal(grouped[0].totalParticipants, 3);
  assert.deepEqual(grouped[0].participantNames, ['Ana Silva', 'Jéssica', 'André']);
  assert.equal(grouped[0].leadingSlot.slot?.id, 's1');
  assert.equal(grouped[0].leadingSlot.votesCount, 2);
  assert.equal(grouped[0].leadingSlot.percentage, 67);
  assert.equal(grouped[0].isConfirmed, false);
});

