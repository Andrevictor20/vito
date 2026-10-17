export function findOrphanNotificationIds(
  scheduled: Array<{ identifier?: string; content?: { data?: { eventId?: string; todoId?: string; pendingId?: string } } }>,
  validEventIds: Set<string> | string[],
  validTodoIds?: Set<string> | string[],
  validPendingIds?: Set<string> | string[],
): string[] {
  const ev = validEventIds instanceof Set ? validEventIds : new Set(validEventIds || []);
  const td = validTodoIds instanceof Set ? validTodoIds : new Set(validTodoIds || []);
  const pd = validPendingIds instanceof Set ? validPendingIds : new Set(validPendingIds || []);
  const orphans: string[] = [];
  for (const n of scheduled || []) {
    const data = n.content?.data || {};
    const eventId: string | undefined = data.eventId;
    const todoId: string | undefined = data.todoId;
    const pendingId: string | undefined = data.pendingId;
    if (eventId && !ev.has(eventId) && n.identifier) orphans.push(n.identifier);
    else if (todoId && !td.has(todoId) && n.identifier) orphans.push(n.identifier);
    else if (pendingId && !pd.has(pendingId) && n.identifier) orphans.push(n.identifier);
  }
  return orphans;
}

export function buildEventScheduleKey(title: string, startMs: number): string {
  return `${(title || '').trim().toLowerCase()}|${startMs}`;
}

/**
 * Evita reagendar repetidamente o mesmo evento a cada loadData/foco de aba (o que fazia
 * notificações descartadas pelo usuário, como "Do my Duolingo", reaparecerem na tela)
 * e deduplica eventos com mesmo título e horário exato de início.
 */
export function shouldSkipReschedulingEvent(
  eventId: string,
  startMs: number,
  scheduledSignatures: Map<string, number>,
  seenBatchKeys?: Set<string>,
  title?: string,
): boolean {
  if (!eventId || !Number.isFinite(startMs)) return true;
  const dedupKey = buildEventScheduleKey(title || eventId, startMs);
  if (seenBatchKeys) {
    if (seenBatchKeys.has(dedupKey)) {
      return true;
    }
    seenBatchKeys.add(dedupKey);
  }
  if (scheduledSignatures.get(eventId) === startMs) {
    return true;
  }
  return false;
}

