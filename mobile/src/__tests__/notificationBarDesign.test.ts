import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildVitoNotificationContent,
  NOTIFICATION_DOMAIN_META,
  registerVitoNotificationChannelsAndCategories,
  sanitizeNotificationTitle,
  VITO_CHANNEL_GROUPS,
  VITO_NOTIFICATION_ACCENT,
  VITO_NOTIFICATION_CATEGORIES,
  VITO_NOTIFICATION_CHANNELS,
} from '../features/notifications/services/notificationDesign';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MOBILE_ROOT = path.resolve(__dirname, '../..');

function readPngDimensions(filePath: string): { width: number; height: number } {
  const buf = fs.readFileSync(filePath);
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${filePath} deve ser PNG válido`);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

describe('Notificação na Barra do Celular — Ícone Mascote v5 & Organização de Canais', () => {
  it('Ícone monocromático do Vito existe em assets e em todas as densidades Android com dimensões exatas', () => {
    const expected: Array<[string, number]> = [
      ['assets/notification-icon.png', 256],
      ['android/app/src/main/res/drawable-mdpi/notification_icon.png', 24],
      ['android/app/src/main/res/drawable-hdpi/notification_icon.png', 36],
      ['android/app/src/main/res/drawable-xhdpi/notification_icon.png', 48],
      ['android/app/src/main/res/drawable-xxhdpi/notification_icon.png', 72],
      ['android/app/src/main/res/drawable-xxxhdpi/notification_icon.png', 96],
    ];
    for (const [rel, sz] of expected) {
      const abs = path.join(MOBILE_ROOT, rel);
      assert.equal(fs.existsSync(abs), true, `${rel} deve existir`);
      const dims = readPngDimensions(abs);
      assert.deepEqual(dims, { width: sz, height: sz }, `${rel} deve ter ${sz}x${sz}px`);
    }

    const monoXml = fs.readFileSync(
      path.join(MOBILE_ROOT, 'android/app/src/main/res/drawable/ic_vito_monochrome.xml'),
      'utf8',
    );
    assert.equal(monoXml.includes('evenOdd'), true, 'ic_vito_monochrome.xml deve usar silhueta vetorial do mascote Vito');
    assert.equal(monoXml.includes('M12,14c1.66,0'), false, 'ic_vito_monochrome.xml não deve mais usar microfone genérico');
  });

  it('app.json e colors.xml usam paleta v5 (#0B7A53 / #DC2626)', () => {
    const appJson = JSON.parse(fs.readFileSync(path.join(MOBILE_ROOT, 'app.json'), 'utf8'));
    assert.equal(appJson.expo.notification.color, VITO_NOTIFICATION_ACCENT);

    const colorsXml = fs.readFileSync(
      path.join(MOBILE_ROOT, 'android/app/src/main/res/values/colors.xml'),
      'utf8',
    );
    assert.equal(colorsXml.includes('notification_icon_color">#0B7A53<'), true);
    assert.equal(colorsXml.includes('notification_alarm_color">#DC2626<'), true);
  });

  it('Canais organizados em 3 grupos, inclui Bots e Finanças, sem rótulo legado "Radares"', async () => {
    assert.equal(VITO_CHANNEL_GROUPS.length, 3);
    const channelIds = VITO_NOTIFICATION_CHANNELS.map((c) => c.id);
    assert.equal(channelIds.includes('vito_bots'), true);
    assert.equal(channelIds.includes('vito_finance'), true);
    assert.equal(channelIds.includes('vito_events'), true);
    assert.equal(channelIds.includes('vito_todos'), true);

    for (const ch of VITO_NOTIFICATION_CHANNELS) {
      assert.equal(ch.name.toLowerCase().includes('radar'), false, `Canal ${ch.id} não deve exibir "Radar" no nome`);
      assert.ok(ch.description.length > 10, `Canal ${ch.id} deve ter descrição clara`);
    }

    assert.equal(VITO_NOTIFICATION_CATEGORIES.length, 4);

    const registeredGroups: string[] = [];
    const registeredChannels: string[] = [];
    const registeredCategories: string[] = [];
    await registerVitoNotificationChannelsAndCategories(
      {
        AndroidImportance: { LOW: 2, HIGH: 4, MAX: 5 },
        AndroidNotificationVisibility: { PUBLIC: 1 },
        setNotificationChannelGroupAsync: async (id) => {
          registeredGroups.push(id);
        },
        setNotificationChannelAsync: async (id) => {
          registeredChannels.push(id);
        },
        setNotificationCategoryAsync: async (id) => {
          registeredCategories.push(id);
        },
      },
      true,
    );
    assert.equal(registeredGroups.length, 3);
    assert.equal(registeredChannels.length, VITO_NOTIFICATION_CHANNELS.length);
    assert.deepEqual(registeredCategories, ['vito_event', 'vito_todo', 'vito_bot', 'vito_finance']);
  });

  it('buildVitoNotificationContent entrega título limpo, subtítulo de domínio, cor v5 e ações rápidas', () => {
    assert.equal(sanitizeNotificationTitle('⚡ Reunião de produto'), 'Reunião de produto');
    assert.equal(sanitizeNotificationTitle('[TESTE] Notificação Vito'), 'Notificação Vito');

    const content = buildVitoNotificationContent({
      channelId: 'vito_events',
      title: '⚡ Revisão semanal',
      body: 'Começa em 10 min · Google Meet',
      data: { eventId: 'evt-1' },
    });

    assert.equal(content.title, 'Revisão semanal');
    assert.equal(content.subtitle, 'Agenda');
    assert.equal(content.color, NOTIFICATION_DOMAIN_META.vito_events.color);
    assert.equal(content.categoryIdentifier, 'vito_event');
  });
});
