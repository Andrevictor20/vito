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
