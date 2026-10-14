export type SyncEventType =
  | 'refresh_all'
  | 'refresh_events'
  | 'refresh_todos'
  | 'refresh_triggers'
  | 'refresh_bookings'
  | 'refresh_pending';

type SyncCallback = () => void;

class DataSyncBus {
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
    const specificListeners = this.listeners.get(eventType);
    if (specificListeners) {
      specificListeners.forEach((cb) => {
        try {
          cb();
        } catch (err) {
          console.warn(`[dataSync] Erro no listener para ${eventType}:`, err);
        }
      });
    }

    if (eventType !== 'refresh_all') {
      const allListeners = this.listeners.get('refresh_all');
      if (allListeners) {
        allListeners.forEach((cb) => {
          try {
            cb();
          } catch (err) {
            console.warn('[dataSync] Erro no listener para refresh_all:', err);
          }
        });
      }
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
