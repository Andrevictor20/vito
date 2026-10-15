/** Filtro puro de radares por categoria (usado no funil da tela Radares). */
export interface RadarFilterInput {
  id: string;
  category: string;
  status: string;
}

export const filterTriggersByCategory = <T extends RadarFilterInput>(
  triggers: T[],
  category: string | 'all'
): T[] => {
  if (category === 'all') return triggers;
  return triggers.filter((t) => t.category === category);
};

export const countTriggersByCategory = <T extends RadarFilterInput>(
  triggers: T[]
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const t of triggers) {
    counts[t.category] = (counts[t.category] ?? 0) + 1;
  }
  return counts;
};
