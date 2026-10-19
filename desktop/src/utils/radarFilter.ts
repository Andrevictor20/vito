/**
 * Filtro puro e utilitário de contagem de radares por categoria
 * Alinhado estritamente com a implementação mobile.
 */
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
  return triggers.filter((t) => t.category.toLowerCase() === category.toLowerCase());
};

export const countTriggersByCategory = <T extends RadarFilterInput>(
  triggers: T[]
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const t of triggers) {
    const key = t.category.toLowerCase();
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
};
