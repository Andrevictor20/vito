export type SyncEventType =
  | 'refresh_all'
  | 'refresh_events'
  | 'refresh_todos'
  | 'refresh_triggers'
  | 'refresh_bookings'
  | 'refresh_pending';

type SyncCallback = () => void;

export class DataSyncBus {
  private listeners: Map<SyncEventType, Set<SyncCallback>> = new Map();

  subscribe(eventType: SyncEventType, callback: SyncCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  notify(eventType: SyncEventType = 'refresh_all'): void {
    const executedCallbacks = new Set<SyncCallback>();

    const runCallbacks = (list?: Set<SyncCallback>) => {
      if (!list) return;
      list.forEach((cb) => {
        if (!executedCallbacks.has(cb)) {
          executedCallbacks.add(cb);
          try {
            cb();
          } catch (err) {
            console.warn(`[dataSync] Erro no listener para ${eventType}:`, err);
          }
        }
      });
    };

    if (eventType === 'refresh_all') {
      // 1. Notifica quem escuta refresh_all
      runCallbacks(this.listeners.get('refresh_all'));
      // 2. Propaga em cascata para todos os listeners específicos
      this.listeners.forEach((set, key) => {
        if (key !== 'refresh_all') {
          runCallbacks(set);
        }
      });
    } else {
      // 1. Notifica os ouvintes específicos do tópico
      runCallbacks(this.listeners.get(eventType));
      // 2. Notifica os ouvintes globais de refresh_all
      runCallbacks(this.listeners.get('refresh_all'));
    }
  }
}

export const dataSync = new DataSyncBus();

// Barramento de prompt externo p/ o chat (§9.4: ações a partir dos radares).
type ChatPromptCallback = (prompt: string) => void;

class ChatPromptBus {
  private listeners = new Set<ChatPromptCallback>();

  subscribe(cb: ChatPromptCallback): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  notify(prompt: string): void {
    this.listeners.forEach((cb) => {
      try {
        cb(prompt);
      } catch (err) {
        console.warn('[chatPromptBus] Erro no listener:', err);
      }
    });
  }
}

export const chatPromptBus = new ChatPromptBus();

// Barramento de navegação lateral direta de abas (§Instagram/TikTok swipe).
type TabNavigationCallback = (tab: 'chat' | 'calendar' | 'tasks' | 'triggers' | 'booking' | 'profile') => void;

export class TabNavigationBus {
  private listeners = new Set<TabNavigationCallback>();

  subscribe(cb: TabNavigationCallback): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  notify(tab: 'chat' | 'calendar' | 'tasks' | 'triggers' | 'booking' | 'profile'): void {
    this.listeners.forEach((cb) => {
      try {
        cb(tab);
      } catch (err) {
        console.warn('[tabNavigationBus] Erro no listener:', err);
      }
    });
  }
}

export const tabNavigationBus = new TabNavigationBus();
