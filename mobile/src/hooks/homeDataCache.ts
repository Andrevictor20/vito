import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Event, Todo } from '../types';

export interface HomeCacheKeys {
  eventsKey: string;
  todosKey: string;
}

export async function readHomeCache(
  keys: HomeCacheKeys
): Promise<{ events?: Event[]; todos?: Todo[] }> {
  const [eventsEntry, todosEntry] = await AsyncStorage.multiGet([
    keys.eventsKey,
    keys.todosKey,
  ]);
  const out: { events?: Event[]; todos?: Todo[] } = {};
  if (eventsEntry?.[1]) {
    try {
      const parsed = JSON.parse(eventsEntry[1]);
      if (Array.isArray(parsed)) out.events = parsed;
    } catch {}
  }
  if (todosEntry?.[1]) {
    try {
      const parsed = JSON.parse(todosEntry[1]);
      if (Array.isArray(parsed)) out.todos = parsed;
    } catch {}
  }
  return out;
}
