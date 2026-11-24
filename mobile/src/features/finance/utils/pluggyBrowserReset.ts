export interface ResettableWebView {
  clearCache?: (includeDiskFiles: boolean) => void;
  clearHistory?: () => void;
  clearFormData?: () => void;
  injectJavaScript?: (script: string) => void;
}

interface NativeWebViewCleaner {
  clearWebViewData?: () => Promise<boolean>;
}

function getDefaultNativeCleaner(): NativeWebViewCleaner | undefined {
  try {
    // Carrega sob demanda para manter compatibilidade com runtime Node/tsx nos testes unitários.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('react-native') as { NativeModules?: { VitoAssistantModule?: NativeWebViewCleaner } };
    return rn?.NativeModules?.VitoAssistantModule;
  } catch {
    return undefined;
  }
}

/**
 * Script defensivo para limpar storage JS da origem atualmente carregada na WebView.
 * Cookies HttpOnly (como Auth0 SSO) são removidos pelo módulo nativo `clearWebViewData`.
 */
export const CLEAR_WEBVIEW_STORAGE_JS = `
(function() {
  try { window.localStorage && window.localStorage.clear(); } catch (_) {}
  try { window.sessionStorage && window.sessionStorage.clear(); } catch (_) {}
  try {
    var cookies = (document.cookie || '').split(';');
    for (var i = 0; i < cookies.length; i++) {
      var eq = cookies[i].indexOf('=');
      var name = (eq > -1 ? cookies[i].slice(0, eq) : cookies[i]).trim();
      if (name) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      }
    }
  } catch (_) {}
  try {
    if (window.caches && typeof window.caches.keys === 'function') {
      window.caches.keys().then(function(keys) {
        keys.forEach(function(k) { window.caches.delete(k); });
      }).catch(function() {});
    }
  } catch (_) {}
  try {
    if (window.indexedDB && typeof window.indexedDB.databases === 'function') {
      window.indexedDB.databases().then(function(dbs) {
        dbs.forEach(function(db) { if (db && db.name) window.indexedDB.deleteDatabase(db.name); });
      }).catch(function() {});
    }
  } catch (_) {}
})();
true;
`;

/**
 * Apaga cookies persistentes, WebStorage, histórico, formulário e cache de disco do WebView Android.
 */
export async function clearPluggyWebViewData(
  webViewRef?: { current: ResettableWebView | null },
  nativeMod: NativeWebViewCleaner | undefined = getDefaultNativeCleaner(),
): Promise<boolean> {
  const view = webViewRef?.current;
  if (view) {
    try {
      view.injectJavaScript?.(CLEAR_WEBVIEW_STORAGE_JS);
      view.clearCache?.(true);
      view.clearHistory?.();
      view.clearFormData?.();
    } catch {
      // ignora erro se o WebView já estiver desmontado
    }
  }

  if (typeof nativeMod?.clearWebViewData === 'function') {
    try {
      return await nativeMod.clearWebViewData();
    } catch {
      return false;
    }
  }
  return false;
}
