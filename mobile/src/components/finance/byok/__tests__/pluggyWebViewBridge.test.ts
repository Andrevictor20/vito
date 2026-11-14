import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { PLUGGY_CAPTURE_BRIDGE_SCRIPT, PLUGGY_CONNECT_BRIDGE_SCRIPT } from '../pluggyWebViewBridge';

const CID = 'b735999c-1306-4759-86de-49af53d01234';
const CSEC_UUID = '9f8e7d6c-5b4a-4321-8765-abcdef123456';
const CSEC_TOKEN = 'plg_secret_9a8b7c6d5e4f3a2b1c0d9e8f7a6b';
const JWT_API_KEY = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature123456';

function createSandbox(hostname: string) {
  const posted: Array<Record<string, unknown>> = [];
  const docListeners: Record<string, Array<() => void>> = {};
  const queryMap: Record<string, unknown[]> = {
    'label, span, p, div, th, td, h1, h2, h3, h4, strong': [],
    'input, textarea': [],
  };

  let clipboardWriteImpl = async (_text: string) => undefined;
  let execCommandImpl = (_cmd: string) => true;

  class FakeXHR {
    responseType = '';
    responseText = '';
    response: unknown = null;
    private listeners: Array<() => void> = [];
    addEventListener(ev: string, fn: () => void) {
      if (ev === 'load') this.listeners.push(fn);
    }
    send() {
      for (const fn of this.listeners) fn.call(this);
    }
  }

  let fetchImpl: (url: string) => Promise<{ headers: { get: (k: string) => string }; clone: () => { text: () => Promise<string> } }> =
    async () => ({
      headers: { get: () => 'application/json' },
      clone: () => ({ text: async () => '{}' }),
    });

  const windowListeners: Record<string, Array<(ev: unknown) => void>> = {};

  const windowObj: Record<string, unknown> = {
    location: { hostname },
    ReactNativeWebView: {
      postMessage: (raw: string) => {
        posted.push(JSON.parse(raw));
      },
    },
    addEventListener: (ev: string, fn: (ev: unknown) => void) => {
      windowListeners[ev] = windowListeners[ev] || [];
      windowListeners[ev].push(fn);
    },
    dispatchWindowEvent: (ev: string, payload: unknown) => {
      for (const fn of windowListeners[ev] ?? []) fn(payload);
    },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    getSelection: () => '',
    fetch: (...args: unknown[]) => fetchImpl(String(args[0] ?? '')),
  };

  const documentObj: Record<string, unknown> = {
    body: { tagName: 'BODY' },
    documentElement: { tagName: 'HTML' },
    activeElement: null,
    addEventListener: (ev: string, fn: () => void) => {
      docListeners[ev] = docListeners[ev] || [];
      docListeners[ev].push(fn);
    },
    createTreeWalker: () => ({ nextNode: () => null }),
    querySelectorAll: (sel: string) => queryMap[sel] ?? [],
    execCommand: (cmd: string) => execCommandImpl(cmd),
  };

  const navigatorObj = {
    clipboard: {
      writeText: (text: string) => clipboardWriteImpl(text),
    },
  };

  const sandbox = {
    window: windowObj,
    document: documentObj,
    navigator: navigatorObj,
    NodeFilter: { SHOW_TEXT: 4 },
    XMLHttpRequest: FakeXHR,
    setTimeout,
    clearTimeout,
  };
  windowObj.document = documentObj;
  windowObj.navigator = navigatorObj;
  return { sandbox, posted, windowObj, documentObj, navigatorObj, queryMap, FakeXHR, setFetch: (fn: typeof fetchImpl) => { fetchImpl = fn; } };
}

describe('PLUGGY_CAPTURE_BRIDGE_SCRIPT', () => {
  it('não instala hooks na tela de login pluggy.auth0.com', () => {
    const ctx = createSandbox('pluggy.auth0.com');
    vm.runInNewContext(PLUGGY_CAPTURE_BRIDGE_SCRIPT, ctx.sandbox);
    assert.equal(ctx.windowObj.__vitoPluggyBridgeInstalled, undefined);
    assert.equal(ctx.windowObj.__vitoScanVisibleKeys, undefined);
  });

  it('captura Client Secret não-UUID retornado via fetch ao clicar em "Gerar novo secret" e ignora API Key JWT', async () => {
    const ctx = createSandbox('dashboard.pluggy.ai');
    ctx.setFetch(async () => ({
      headers: { get: () => 'application/json; charset=utf-8' },
      clone: () => ({
        text: async () =>
          JSON.stringify({
            clientId: CID,
            clientSecret: CSEC_TOKEN,
            apiKey: JWT_API_KEY,
          }),
      }),
    }));

    vm.runInNewContext(PLUGGY_CAPTURE_BRIDGE_SCRIPT, ctx.sandbox);
    const wrappedFetch = ctx.windowObj.fetch as (u: string) => Promise<unknown>;
    await wrappedFetch('https://dashboard.pluggy.ai/api/applications/secret');
    await new Promise((r) => setTimeout(r, 15));

    assert.equal(ctx.posted.length, 1);
    assert.deepEqual(ctx.posted[0], {
      type: 'captured_keys',
      clientId: CID,
      clientSecret: CSEC_TOKEN,
      source: 'network',
    });
  });

  it('captura via document.execCommand("copy") em textarea temporário mas nunca lê input type="password"', () => {
    const ctx = createSandbox('dashboard.pluggy.ai');
    vm.runInNewContext(PLUGGY_CAPTURE_BRIDGE_SCRIPT, ctx.sandbox);

    ctx.documentObj.activeElement = { tagName: 'INPUT', type: 'password', value: CSEC_UUID };
    (ctx.documentObj.execCommand as (c: string) => boolean)('copy');
    assert.equal(ctx.posted.length, 0);

    ctx.documentObj.activeElement = { tagName: 'TEXTAREA', type: 'textarea', value: CSEC_UUID };
    (ctx.documentObj.execCommand as (c: string) => boolean)('copy');
    assert.equal(ctx.posted.length, 1);
    assert.deepEqual(ctx.posted[0], {
      type: 'clipboard_copy',
      rawText: CSEC_UUID,
      source: 'copy',
    });
  });

  it('captura Client Secret ancorado em <input readonly> ao lado do rótulo "Client Secret" durante scan', () => {
    const ctx = createSandbox('dashboard.pluggy.ai');
    const rowBox = {
      textContent: `Client Secret  ${CSEC_TOKEN}`,
      innerText: `Client Secret ${CSEC_TOKEN}`,
      parentElement: { tagName: 'BODY' },
      querySelectorAll: () => [{ tagName: 'INPUT', type: 'text', value: CSEC_TOKEN }],
    };
    const labelEl = { textContent: 'Client Secret', parentElement: rowBox };
    ctx.queryMap['label, span, p, div, th, td, h1, h2, h3, h4, strong'] = [labelEl];

    vm.runInNewContext(PLUGGY_CAPTURE_BRIDGE_SCRIPT, ctx.sandbox);
    (ctx.windowObj.__vitoScanVisibleKeys as () => void)();

    assert.equal(ctx.posted.length, 1);
    assert.equal(ctx.posted[0].clientSecret, CSEC_TOKEN);
    assert.equal(ctx.posted[0].source, 'scan');
  });
});

describe('PLUGGY_CONNECT_BRIDGE_SCRIPT', () => {
  it('captura itemId via fetch /items e postMessage no connect.pluggy.ai', async () => {
    const ctx = createSandbox('connect.pluggy.ai');
    const ITEM_ID = '11111111-2222-4333-8444-555555555555';
    const ITEM_ID_2 = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

    ctx.setFetch((async () => ({
      headers: { get: () => 'application/json' },
      clone: () => ({
        text: async () => '{}',
        json: async () => ({ id: ITEM_ID, connector: { id: 200 }, status: 'UPDATED' }),
      }),
    })) as never);

    vm.runInNewContext(PLUGGY_CONNECT_BRIDGE_SCRIPT, ctx.sandbox);

    const wrappedFetch = ctx.windowObj.fetch as (u: string) => Promise<unknown>;
    await wrappedFetch('https://api.pluggy.ai/items');
    await new Promise((r) => setTimeout(r, 15));

    const dispatch = ctx.windowObj.dispatchWindowEvent as (ev: string, p: unknown) => void;
    dispatch('message', { data: JSON.stringify({ item: { id: ITEM_ID_2, status: 'LOGIN_IN_PROGRESS' } }) });

    assert.equal(ctx.posted.length, 2);
    assert.deepEqual(ctx.posted[0], {
      type: 'pluggy_connect_item',
      itemId: ITEM_ID,
      status: 'UPDATED',
      source: 'network',
    });
    assert.deepEqual(ctx.posted[1], {
      type: 'pluggy_connect_item',
      itemId: ITEM_ID_2,
      status: 'LOGIN_IN_PROGRESS',
      source: 'postmessage',
    });
  });
});
