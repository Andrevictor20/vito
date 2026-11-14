import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { CLEAR_WEBVIEW_STORAGE_JS, clearPluggyWebViewData, ResettableWebView } from '../pluggyBrowserReset';

describe('pluggyBrowserReset', () => {
  it('limpa cache, histórico, formData e invoca clearWebViewData nativo quando disponível', async () => {
    const calls: string[] = [];
    const fakeRef: { current: ResettableWebView | null } = {
      current: {
        injectJavaScript: (s) => {
          assert.ok(s.includes('localStorage'));
          calls.push('inject');
        },
        clearCache: (disk) => {
          assert.equal(disk, true);
          calls.push('clearCache');
        },
        clearHistory: () => calls.push('clearHistory'),
        clearFormData: () => calls.push('clearFormData'),
      },
    };

    const clearedNative = await clearPluggyWebViewData(fakeRef, {
      clearWebViewData: async () => {
        calls.push('native');
        return true;
      },
    });

    assert.equal(clearedNative, true);
    assert.deepEqual(calls, ['inject', 'clearCache', 'clearHistory', 'clearFormData', 'native']);
  });

  it('retorna false de forma segura quando o módulo nativo falha ou está ausente', async () => {
    assert.equal(await clearPluggyWebViewData(undefined, undefined), false);
    assert.equal(
      await clearPluggyWebViewData(undefined, {
        clearWebViewData: async () => {
          throw new Error('boom');
        },
      }),
      false,
    );
  });

  it('CLEAR_WEBVIEW_STORAGE_JS limpa localStorage, sessionStorage e cookies em sandbox', () => {
    let localCleared = false;
    let sessionCleared = false;
    let cookieAssigned = '';
    const windowObj = {
      localStorage: { clear: () => { localCleared = true; } },
      sessionStorage: { clear: () => { sessionCleared = true; } },
    };
    const documentObj = {
      get cookie() {
        return 'pluggy_sess=abc; auth0=xyz';
      },
      set cookie(val: string) {
        cookieAssigned += `${val}|`;
      },
    };
    vm.runInNewContext(CLEAR_WEBVIEW_STORAGE_JS, { window: windowObj, document: documentObj });
    assert.equal(localCleared, true);
    assert.equal(sessionCleared, true);
    assert.ok(cookieAssigned.includes('pluggy_sess=;'));
    assert.ok(cookieAssigned.includes('auth0=;'));
  });
});
