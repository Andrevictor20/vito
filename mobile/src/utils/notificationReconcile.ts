export function findOrphanNotificationIds(
  scheduled: Array<{ identifier?: string; content?: { data?: { eventId?: string; todoId?: string } } }>,
  validEventIds: Set<string> | string[],
  validTodoIds?: Set<string> | string[],
): string[] {
  const ev = validEventIds instanceof Set ? validEventIds : new Set(validEventIds || []);
  const td = validTodoIds instanceof Set ? validTodoIds : new Set(validTodoIds || []);
  const orphans: string[] = [];
  for (const n of scheduled || []) {
    const data: any = (n as any)?.content?.data || {};
    const eventId: string | undefined = data.eventId;
    const todoId: string | undefined = data.todoId;
    if (eventId && !ev.has(eventId) && n.identifier) orphans.push(n.identifier);
    else if (todoId && !td.has(todoId) && n.identifier) orphans.push(n.identifier);
  }
  return orphans;
}
