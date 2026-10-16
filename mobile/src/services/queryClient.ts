import { QueryClient } from '@tanstack/react-query';
import { dataSync } from './dataSync';

// MOB-04: cache server-state gradual (antes tudo manual via AsyncStorage + dataSync).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const queryKeys = {
  triggers: (userId?: string) => ['triggers', userId || 'default'] as const,
  todos: (userId?: string) => ['todos', userId || 'default'] as const,
  events: (userId?: string) => ['events', userId || 'default'] as const,
};

// Ponte dataSync -> React Query (eventos legados continuam funcionando).
dataSync.subscribe('refresh_triggers', () => {
  queryClient.invalidateQueries({ queryKey: ['triggers'] }).catch(() => {});
});
dataSync.subscribe('refresh_events', () => {
  queryClient.invalidateQueries({ queryKey: ['events'] }).catch(() => {});
});
dataSync.subscribe('refresh_todos', () => {
  queryClient.invalidateQueries({ queryKey: ['todos'] }).catch(() => {});
});
dataSync.subscribe('refresh_bookings', () => {
  queryClient.invalidateQueries({ queryKey: ['bookings'] }).catch(() => {});
});
dataSync.subscribe('refresh_pending', () => {
  queryClient.invalidateQueries({ queryKey: ['pending'] }).catch(() => {});
});
dataSync.subscribe('refresh_all', () => {
  queryClient.invalidateQueries().catch(() => {});
});
