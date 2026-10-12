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
