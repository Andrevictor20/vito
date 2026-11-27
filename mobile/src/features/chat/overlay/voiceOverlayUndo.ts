import { api } from '../../../services/api';
import { dataSync } from '../../../services/dataSync';
import type { OverlayActionCardData } from './voiceOverlayHelpers';

/** Desfaz no backend a criação de evento ou tarefa disparada pelo overlay de voz. */
export async function undoOverlayEntity(card: OverlayActionCardData | null): Promise<string> {
  if (!card?.entityId || !card?.entityKind) {
    return 'Ação removida.';
  }
  if (card.entityKind === 'event') {
    await api.deleteEvent(card.entityId);
  } else if (card.entityKind === 'todo') {
    await api.deleteTodo(card.entityId);
  }
  dataSync.notify('refresh_all');
  return 'Ação desfeita no seu registro.';
}
