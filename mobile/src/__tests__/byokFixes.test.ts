import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createConnectToken } from '../services/pluggyService';

const MOBILE_SRC = path.resolve(__dirname, '..');

function fakeFetch(status: number, body: unknown, calls: { url: string; init?: RequestInit }[]): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
  }) as unknown as typeof fetch;
}

describe('BYOK fixes & cleanup', () => {
  it('createConnectToken inclui itemId nas options quando informado para reconexão 1-toque', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const tok = await createConnectToken(
      'K',
      'user-1',
      fakeFetch(200, { accessToken: 'T-RECONNECT' }, calls),
      'item-uuid-123',
    );
    assert.equal(tok, 'T-RECONNECT');
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      options: {
        clientUserId: 'user-1',
        oauthRedirectUri: 'vito://pluggy-success',
        itemId: 'item-uuid-123',
      },
    });
  });

  it('remove código morto de WebView in-app (PluggyPortalWebView e pluggyWebViewBridge)', () => {
    assert.equal(
      fs.existsSync(path.join(MOBILE_SRC, 'components/finance/byok/PluggyPortalWebView.tsx')),
      false,
      'PluggyPortalWebView.tsx deve ser removido',
    );
    assert.equal(
      fs.existsSync(path.join(MOBILE_SRC, 'components/finance/byok/pluggyWebViewBridge.ts')),
      false,
      'pluggyWebViewBridge.ts deve ser removido',
    );

    const hookSrc = fs.readFileSync(path.join(MOBILE_SRC, 'hooks/useByokSetup.ts'), 'utf8');
    assert.equal(hookSrc.includes('PluggyPortalWebView'), false, 'useByokSetup não deve importar PluggyPortalWebView');
    assert.equal(hookSrc.includes('setPortalMode'), false, 'useByokSetup não deve manter portalMode morto');
    assert.equal(hookSrc.includes('setWebViewOpen'), false, 'useByokSetup não deve manter webViewOpen morto');
  });

  it('PluggyConnectModal usa mode manual + connectionId no sync e oferece Reconectar para bancos com erro', () => {
    const modalSrc = fs.readFileSync(path.join(MOBILE_SRC, 'screens/PluggyConnectModal.tsx'), 'utf8');
    assert.equal(modalSrc.includes("mode: 'manual'"), true, 'handleSyncConnection deve usar mode: manual');
    assert.equal(modalSrc.includes('connectionId: conn.id'), true, 'handleSyncConnection deve passar connectionId');
    assert.equal(modalSrc.includes('openReconnectExternal'), true, 'PluggyConnectModal deve oferecer reconexão 1-toque');
    assert.equal(modalSrc.includes('navegador interno'), false, 'Alerta de reset não deve citar navegador interno');
  });

  it('ByokSyncProgress pluga ByokQuickLimitsCard em doneV e usa BrandLogo', () => {
    const progSrc = fs.readFileSync(path.join(MOBILE_SRC, 'components/finance/byok/ByokSyncProgress.tsx'), 'utf8');
    assert.equal(progSrc.includes('ByokQuickLimitsCard'), true, 'ByokSyncProgress deve renderizar ByokQuickLimitsCard');
    assert.equal(progSrc.includes('BrandLogo'), true, 'ByokSyncProgress deve usar BrandLogo para bancos conhecidos');
  });

  it('pluggySync suporta sincronização multi-item no onboarding quando itemId é omitido', () => {
    const syncSrc = fs.readFileSync(path.join(MOBILE_SRC, 'services/pluggySync.ts'), 'utf8');
    assert.equal(syncSrc.includes('syncAllDiscoveredItems'), true, 'pluggySync deve exportar syncAllDiscoveredItems');
  });
});
