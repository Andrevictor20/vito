import type { Meeting, MeetingSlot } from '../types';

export interface SelectedMeetingSlot {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
}

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  name: string;
  contact_info?: string;
  vito_user_id?: string;
  voted_slot_ids?: string[];
  responded_at: string;
}

export interface MeetingVoteActivityItem {
  id: string;
  meetingId: string;
  meetingTitle: string;
  meetingStatus: Meeting['status'];
  participantId: string;
  participantName: string;
  contactInfo?: string;
  respondedAt: string;
  votedSlotIds: string[];
  votedLabels: string[];
  winningSlotId?: string;
  winningSlotLabel?: string;
}

const PT_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function toggleMeetingSlotSelection(
  current: SelectedMeetingSlot[],
  date: string,
  time: string
): SelectedMeetingSlot[] {
  const exists = current.some((s) => s.date === date && s.time === time);
  const next = exists
    ? current.filter((s) => !(s.date === date && s.time === time))
    : [...current, { date, time }];

  return next.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
}

function toBRTComponents(isoString: string): {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
} {
  const d = new Date(isoString);
  const brtMs = d.getTime() - 3 * 3600 * 1000;
  const brt = new Date(brtMs);
  return {
    year: brt.getUTCFullYear(),
    month: brt.getUTCMonth() + 1,
    day: brt.getUTCDate(),
    weekday: brt.getUTCDay(),
    hour: brt.getUTCHours(),
    minute: brt.getUTCMinutes(),
  };
}

export function formatSlotBRTDisplay(
  startIso: string,
  endIso?: string
): {
  dateKey: string;
  dateLabel: string;
  startTime: string;
  endTime: string;
  timeRange: string;
  compactLabel: string;
} {
  const st = toBRTComponents(startIso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateKey = `${st.year}-${pad(st.month)}-${pad(st.day)}`;
  const wd = PT_WEEKDAYS[st.weekday] || '';
  const dateLabel = `${pad(st.day)}/${pad(st.month)} (${wd})`;
  const startTime = `${pad(st.hour)}:${pad(st.minute)}`;

  let endTime = '';
  if (endIso) {
    const et = toBRTComponents(endIso);
    endTime = `${pad(et.hour)}:${pad(et.minute)}`;
  }

  const timeRange = endTime ? `${startTime} – ${endTime}` : startTime;
  const compactLabel = `${dateLabel} • ${startTime}`;

  return {
    dateKey,
    dateLabel,
    startTime,
    endTime,
    timeRange,
    compactLabel,
  };
}

export function slotBRTToISO(
  date: string,
  time: string,
  durationMinutes: number
): { start_at: string; end_at: string } {
  const start = new Date(`${date}T${time}:00-03:00`);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  return {
    start_at: start.toISOString(),
    end_at: end.toISOString(),
  };
}

export function slotsFromMeetingDetails(slots?: MeetingSlot[]): SelectedMeetingSlot[] {
  if (!Array.isArray(slots)) return [];
  return slots.map((s) => {
    const f = formatSlotBRTDisplay(s.start_at, s.end_at);
    return { date: f.dateKey, time: f.startTime };
  });
}

export function computeSlotVotePercentage(votesCount: number, totalParticipants: number): number {
  if (totalParticipants <= 0 || votesCount <= 0) return 0;
  return Math.min(100, Math.round((votesCount / totalParticipants) * 100));
}

export function computeBookingTabCounts(
  bookingTypesCount: number,
  meetings: Meeting[],
  appointmentsCount: number
): { linksCount: number; receivedCount: number } {
  const safeMeetings = Array.isArray(meetings) ? meetings : [];
  const activeMeetingPollsCount = safeMeetings.filter(
    (m: any) => Array.isArray(m.participants) && m.participants.length > 0
  ).length;

  return {
    linksCount: (bookingTypesCount || 0) + safeMeetings.length,
    receivedCount: (appointmentsCount || 0) + activeMeetingPollsCount,
  };
}

export function extractMeetingVotesActivity(meetings: Meeting[]): MeetingVoteActivityItem[] {
  if (!Array.isArray(meetings)) return [];
  const items: MeetingVoteActivityItem[] = [];

  for (const m of meetings) {
    const slots = Array.isArray(m.slots) ? m.slots : [];
    const slotById = new Map<string, MeetingSlot>();
    let winningSlot: MeetingSlot | undefined;

    for (const s of slots) {
      slotById.set(s.id, s);
      const votes = s.votes_count || 0;
      const winVotes = winningSlot?.votes_count || 0;
      if (s.is_winner || (winningSlot && votes > winVotes) || (!winningSlot && votes > 0)) {
        winningSlot = s;
      }
    }

    const winningFormatted = winningSlot
      ? formatSlotBRTDisplay(winningSlot.start_at, winningSlot.end_at)
      : undefined;

    const participants: MeetingParticipant[] = Array.isArray((m as any).participants)
      ? (m as any).participants
      : [];
    for (const p of participants) {
      const votedIds = Array.isArray(p.voted_slot_ids) ? p.voted_slot_ids : [];
      const votedLabels: string[] = [];

      for (const sid of votedIds) {
        const sl = slotById.get(sid);
        if (sl) {
          votedLabels.push(formatSlotBRTDisplay(sl.start_at, sl.end_at).compactLabel);
        }
      }

      if (votedLabels.length === 0) {
        for (const sl of slots) {
          const voterNames = (sl as any).voter_names;
          if (Array.isArray(voterNames) && voterNames.includes(p.name)) {
            votedLabels.push(formatSlotBRTDisplay(sl.start_at, sl.end_at).compactLabel);
          }
        }
      }

      items.push({
        id: `${m.id}_${p.id}`,
        meetingId: m.id,
        meetingTitle: m.title,
        meetingStatus: m.status,
        participantId: p.id,
        participantName: p.name,
        contactInfo: p.contact_info,
        respondedAt: p.responded_at,
        votedSlotIds: votedIds,
        votedLabels,
        winningSlotId: winningSlot?.id,
        winningSlotLabel: winningFormatted?.compactLabel,
      });
    }
  }

  return items.sort((a, b) => (b.respondedAt || '').localeCompare(a.respondedAt || ''));
}

export interface LeadingSlotInfo {
  slot?: MeetingSlot;
  formatted?: ReturnType<typeof formatSlotBRTDisplay>;
  votesCount: number;
  percentage: number;
  voterNames: string[];
}

export function getLeadingSlot(slots?: MeetingSlot[], totalParticipants = 0): LeadingSlotInfo {
  if (!Array.isArray(slots) || slots.length === 0) {
    return { votesCount: 0, percentage: 0, voterNames: [] };
  }

  let leading: MeetingSlot | undefined;
  for (const s of slots) {
    const voters = Array.isArray((s as any).voter_names) ? (s as any).voter_names : [];
    const count = Math.max(s.votes_count || 0, voters.length);
    if (!leading) {
      leading = s;
    } else {
      const leadingVoters = Array.isArray((leading as any).voter_names) ? (leading as any).voter_names : [];
      const leadingCount = Math.max(leading.votes_count || 0, leadingVoters.length);
      if (s.is_winner || count > leadingCount) {
        leading = s;
      }
    }
  }

  if (!leading) {
    return { votesCount: 0, percentage: 0, voterNames: [] };
  }

  const voterNames = Array.isArray((leading as any).voter_names) ? (leading as any).voter_names : [];
  const votesCount = Math.max(leading.votes_count || 0, voterNames.length);
  const percentage = computeSlotVotePercentage(votesCount, totalParticipants);
  const formatted = formatSlotBRTDisplay(leading.start_at, leading.end_at);

  return {
    slot: leading,
    formatted,
    votesCount,
    percentage,
    voterNames,
  };
}

export interface GroupedMeetingPollItem {
  meeting: Meeting;
  meetingId: string;
  meetingTitle: string;
  meetingStatus: 'open' | 'confirmed' | 'expired' | 'cancelled';
  totalParticipants: number;
  participantNames: string[];
  leadingSlot: LeadingSlotInfo;
  isConfirmed: boolean;
  confirmedSlotLabel?: string;
}

export function extractGroupedMeetingPolls(meetings: Meeting[]): GroupedMeetingPollItem[] {
  if (!Array.isArray(meetings)) return [];
  const items: GroupedMeetingPollItem[] = [];

  for (const m of meetings) {
    const participants: MeetingParticipant[] = Array.isArray((m as any).participants)
      ? (m as any).participants
      : [];
    if (participants.length === 0) continue;

    const slots = Array.isArray(m.slots) ? m.slots : [];
    const leading = getLeadingSlot(slots, participants.length);
    const participantNames = participants.map((p) => p.name).filter(Boolean);

    let confirmedSlotLabel: string | undefined;
    if (m.status === 'confirmed' && m.confirmed_slot_id) {
      const confSlot = slots.find((s) => s.id === m.confirmed_slot_id);
      if (confSlot) {
        confirmedSlotLabel = formatSlotBRTDisplay(confSlot.start_at, confSlot.end_at).compactLabel;
      }
    }

    items.push({
      meeting: m,
      meetingId: m.id,
      meetingTitle: m.title,
      meetingStatus: m.status,
      totalParticipants: participants.length,
      participantNames,
      leadingSlot: leading,
      isConfirmed: m.status === 'confirmed',
      confirmedSlotLabel,
    });
  }

  return items.sort((a, b) => {
    if (a.isConfirmed !== b.isConfirmed) return a.isConfirmed ? 1 : -1;
    return b.totalParticipants - a.totalParticipants;
  });
}

export function getMeetingShareButtonLabel(isConfirmed: boolean): string {
  return isConfirmed ? 'Compartilhar Confirmação' : 'Compartilhar Enquete';
}

export function buildMeetingShareMessage(meeting: Meeting, link: string): string {
  const isConfirmed = meeting.status === 'confirmed';
  const slots = Array.isArray(meeting.slots) ? meeting.slots : [];
  const participants: MeetingParticipant[] = Array.isArray((meeting as any).participants)
    ? (meeting as any).participants
    : [];
  const confirmedSlot = slots.find((s) => s.id === meeting.confirmed_slot_id);

  if (isConfirmed && confirmedSlot) {
    const confLabel = formatSlotBRTDisplay(confirmedSlot.start_at, confirmedSlot.end_at).compactLabel;
    const partNames = participants.map((p) => p.name).filter(Boolean).join(', ');
    return `🎉 Reunião Confirmada!\n📌 ${meeting.title}\n📅 Horário Definido: ${confLabel}${partNames ? `\n👥 Participantes: ${partNames}` : ''}\n🔗 Detalhes / Acesso: ${link}`;
  }

  return `Olá! Participe da votação de horários para a nossa reunião "${meeting.title}":\n${link}`;
}
