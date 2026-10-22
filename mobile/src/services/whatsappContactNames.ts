import { api } from './api';
import { getDeviceContacts, requestContactsPermission } from './contactMatchingService';
import { SavedContactName, buildSavedNames } from '../utils/savedContactNames';

export interface ContactNamesSyncResult {
  /** Quantos contatos foram enviados ao servidor. */
  sent: number;
  /** Quantos contacts da agenda tinham nome e telefone utilizáveis. */
  usable: number;
  /** A permissão de contatos foi negada. */
  permissionDenied: boolean;
}

/**
 * Envia ao servidor o nome SALVO de cada contato da agenda do celular.
 *
 * O Vito reconhece o contato pelo nome que o dono deu a ele ("isa"), não pelo
 * nome de perfil que a pessoa escolheu no WhatsApp ("bella"). Esse nome salvo
 * vive no CELULAR — a Evolution não expõe a agenda — então o app é a via de
 * Levá-lo até o servidor (que é o próprio servidor do usuário).
 */
export async function syncSavedContactNames(): Promise<ContactNamesSyncResult> {
  const granted = await requestContactsPermission();
  if (!granted) {
    return { sent: 0, usable: 0, permissionDenied: true };
  }

  const contacts = await getDeviceContacts();
  const names = buildSavedNames(contacts);

  if (names.length === 0) {
    return { sent: 0, usable: 0, permissionDenied: false };
  }

  // O envio pode ser grande: a agenda do celular tem centenas de contatos.
  let sent = 0;
  const LOTE = 500;
  for (let i = 0; i < names.length; i += LOTE) {
    const res = await api.importWhatsAppContactNames(names.slice(i, i + LOTE));
    sent += res?.imported ?? 0;
  }

  return { sent, usable: names.length, permissionDenied: false };
}
