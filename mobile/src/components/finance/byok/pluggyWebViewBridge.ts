/**
 * Script injetado na WebView do Painel Pluggy (`PluggyDashboardWebView`).
 * Regras estritas de privacidade:
 * - Atua exclusivamente em `dashboard.pluggy.ai` (inócuo em `pluggy.auth0.com` e OAuth).
 * - Nunca lê `<input type="password">`, `<input type="email">` nem `document.cookie`.
 * - Captura Client ID e Client Secret via resposta JSON (`fetch`/`XHR`), cópia explícita ou leitura da tela.
 */
export const PLUGGY_CAPTURE_BRIDGE_SCRIPT = `
(function () {
  if (!window.location || window.location.hostname !== 'dashboard.pluggy.ai') return true;

  var UUID_EXACT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var UUID_G = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ig;

  function isSecretCandidate(val) {
    if (typeof val !== 'string') return false;
    var t = val.trim();
    if (t.length < 20 || t.length > 128) return false;
    if (/^eyJ[A-Za-z0-9_-]*\\.[A-Za-z0-9_-]*/.test(t)) return false;
    if (/^https?:/i.test(t)) return false;
    if (/[•*\\s]/.test(t) || /\\.\\.\\.$|…$/.test(t)) return false;
    if (UUID_EXACT.test(t)) return true;
    return /^[A-Za-z0-9_.\\-=+\\/]{20,128}$/.test(t) && /\\d/.test(t) && !/^[a-z-]+$/.test(t);
  }

  function post(payload) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        var json = JSON.stringify(payload);
        if (json.length <= 2048) window.ReactNativeWebView.postMessage(json);
      }
    } catch (_) {}
  }

  function isSensitiveField(el) {
    if (!el) return false;
    var type = (el.type || '').toLowerCase();
    return type === 'password' || type === 'email' || type === 'hidden';
  }

  function extractUuids(text) {
    var m = typeof text === 'string' ? text.match(UUID_G) : null;
    if (!m) return [];
    var seen = {};
    var out = [];
    for (var i = 0; i < m.length && out.length < 6; i++) {
      var k = m[i].toLowerCase();
      if (!seen[k]) {
        seen[k] = true;
        out.push(m[i]);
      }
    }
    return out;
  }

  function extractFromJson(node, depth, out) {
    if (!node || typeof node !== 'object' || depth > 5) return;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length && i < 20; i++) extractFromJson(node[i], depth + 1, out);
      return;
    }
    var keys = Object.keys(node);
    for (var j = 0; j < keys.length; j++) {
      var k = keys[j];
      var v = node[k];
      if (typeof v === 'string') {
        var kl = k.toLowerCase();
        var trimmed = v.trim();
        if ((kl === 'clientid' || kl === 'client_id') && UUID_EXACT.test(trimmed)) {
          out.clientId = trimmed;
        } else if ((kl === 'clientsecret' || kl === 'client_secret' || kl === 'secret') && isSecretCandidate(trimmed)) {
          out.clientSecret = trimmed;
        }
      } else if (v && typeof v === 'object') {
        extractFromJson(v, depth + 1, out);
      }
    }
  }

  function inspectJsonString(rawText) {
    if (typeof rawText !== 'string' || rawText.length < 10 || rawText.length > 262144) return;
    if (rawText.indexOf('clientSecret') === -1 && rawText.indexOf('client_secret') === -1 && rawText.indexOf('"secret"') === -1 && rawText.indexOf('clientId') === -1 && rawText.indexOf('client_id') === -1) {
      return;
    }
    try {
      var parsed = JSON.parse(rawText);
      var out = {};
      extractFromJson(parsed, 0, out);
      if (out.clientSecret || out.clientId) {
        post({
          type: out.clientId && out.clientSecret ? 'captured_keys' : 'partial_keys',
          clientId: out.clientId || '',
          clientSecret: out.clientSecret || '',
          source: 'network'
        });
      }
    } catch (_) {}
  }

  function collectAnchoredKeys() {
    var result = { clientId: '', clientSecret: '' };
    try {
      var els = document.querySelectorAll('label, span, p, div, th, td, h1, h2, h3, h4, strong');
      for (var i = 0; i < els.length && i < 400; i++) {
        var el = els[i];
        var labelTxt = (el.textContent || '').trim();
        if (!labelTxt || labelTxt.length > 42) continue;
        var isIdLabel = /^client\\s*id$/i.test(labelTxt);
        var isSecLabel = /^client\\s*secret$/i.test(labelTxt) || /^novo\\s+client\\s*secret$/i.test(labelTxt);
        if (!isIdLabel && !isSecLabel) continue;

        var box = el.parentElement;
        for (var step = 0; step < 3 && box && box.parentElement && box.parentElement.tagName !== 'BODY'; step++) {
          var boxTxt = (box.textContent || '');
          if (boxTxt.length >= 40 && boxTxt.length <= 900) break;
          box = box.parentElement;
        }
        if (!box) continue;

        var inputs = box.querySelectorAll ? box.querySelectorAll('input, textarea') : [];
        for (var k = 0; k < inputs.length; k++) {
          var inp = inputs[k];
          if (isSensitiveField(inp)) continue;
          var iv = (inp.value || '').trim();
          if (isIdLabel && !result.clientId && UUID_EXACT.test(iv)) result.clientId = iv;
          if (isSecLabel && !result.clientSecret && isSecretCandidate(iv)) result.clientSecret = iv;
        }

        var parts = (box.innerText || box.textContent || '').split(/\\s+/);
        for (var p = 0; p < parts.length; p++) {
          var tok = parts[p].trim();
          if (isIdLabel && !result.clientId && UUID_EXACT.test(tok)) result.clientId = tok;
          if (isSecLabel && !result.clientSecret && isSecretCandidate(tok)) {
            if (!result.clientId || tok.toLowerCase() !== result.clientId.toLowerCase()) {
              result.clientSecret = tok;
            }
          }
        }
      }
    } catch (_) {}
    return result;
  }

  function scanVisible(source) {
    try {
      var anchored = collectAnchoredKeys();
      var chunks = [];
      if (document.body || document.documentElement) {
        var walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, null);
        var node;
        while ((node = walker.nextNode())) {
          var el = node.parentElement;
          if (!el) continue;
          var tag = el.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') continue;
          var style = window.getComputedStyle ? window.getComputedStyle(el) : null;
          if (style && (style.display === 'none' || style.visibility === 'hidden')) continue;
          var txt = (node.nodeValue || '').trim();
          if (txt) chunks.push(txt);
        }
        var inputs = document.querySelectorAll ? document.querySelectorAll('input, textarea') : [];
        for (var i = 0; i < inputs.length; i++) {
          var inp = inputs[i];
          if (isSensitiveField(inp)) continue;
          var val = (inp.value || '').trim();
          if (val) chunks.push(val);
        }
      }

      var joined = chunks.join(' ');
      var matches = extractUuids(joined);
      var masked = /[•*]{2,}/.test(joined);
      var cid = anchored.clientId || matches[0] || '';
      var csec = anchored.clientSecret || '';
      if (!csec) {
        for (var m = 0; m < matches.length; m++) {
          if (matches[m].toLowerCase() !== cid.toLowerCase()) {
            csec = matches[m];
            break;
          }
        }
      }

      if (source === 'auto_scan') {
        if (!cid && !csec) return;
        var sig = cid + '|' + csec;
        if (window.__vitoLastAutoSig === sig) return;
        window.__vitoLastAutoSig = sig;
      }

      post({
        type: cid && csec ? 'captured_keys' : 'partial_keys',
        clientId: cid,
        clientSecret: csec,
        uuids: matches,
        maskedSecretDetected: masked,
        source: source
      });
    } catch (_) {}
  }

  function handleCopiedText(raw, source) {
    var s = typeof raw === 'string' ? raw.trim() : '';
    if (!s) return;
    if (extractUuids(s).length > 0 || isSecretCandidate(s)) {
      post({ type: 'clipboard_copy', rawText: s, source: source });
    }
  }

  if (!window.__vitoPluggyBridgeInstalled) {
    window.__vitoPluggyBridgeInstalled = true;

    if (typeof window.fetch === 'function') {
      var origFetch = window.fetch.bind(window);
      window.fetch = function () {
        var p = origFetch.apply(window, arguments);
        try {
          p.then(function (res) {
            try {
              if (!res || typeof res.clone !== 'function') return;
              var ct = res.headers && res.headers.get ? (res.headers.get('content-type') || '') : '';
              if (ct && ct.toLowerCase().indexOf('json') === -1) return;
              res.clone().text().then(inspectJsonString).catch(function () {});
            } catch (_) {}
          }).catch(function () {});
        } catch (_) {}
        return p;
      };
    }

    if (typeof XMLHttpRequest !== 'undefined' && XMLHttpRequest.prototype) {
      var origSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function () {
        try {
          this.addEventListener('load', function () {
            try {
              if (this.responseType === 'json' && this.response) {
                var out = {};
                extractFromJson(this.response, 0, out);
                if (out.clientSecret || out.clientId) {
                  post({
                    type: out.clientId && out.clientSecret ? 'captured_keys' : 'partial_keys',
                    clientId: out.clientId || '',
                    clientSecret: out.clientSecret || '',
                    source: 'network'
                  });
                }
              } else if (!this.responseType || this.responseType === 'text') {
                inspectJsonString(this.responseText);
              }
            } catch (_) {}
          });
        } catch (_) {}
        return origSend.apply(this, arguments);
      };
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      var origWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = function (text) {
        try { handleCopiedText(text, 'clipboard'); } catch (_) {}
        return origWrite(text);
      };
    }

    if (typeof document.execCommand === 'function') {
      var origExec = document.execCommand.bind(document);
      document.execCommand = function (cmd) {
        if (typeof cmd === 'string' && cmd.toLowerCase() === 'copy') {
          try {
            var active = document.activeElement;
            if (active && !isSensitiveField(active) && typeof active.value === 'string' && active.value) {
              handleCopiedText(active.value, 'copy');
            } else if (window.getSelection) {
              handleCopiedText(String(window.getSelection()), 'copy');
            }
          } catch (_) {}
        }
        return origExec.apply(document, arguments);
      };
    }

    document.addEventListener('copy', function () {
      try {
        var active = document.activeElement;
        if (active && isSensitiveField(active)) return;
        var sel = window.getSelection ? String(window.getSelection()) : '';
        if (sel) {
          handleCopiedText(sel, 'copy');
        } else if (active && typeof active.value === 'string') {
          handleCopiedText(active.value, 'copy');
        }
      } catch (_) {}
    }, true);

    window.__vitoScanVisibleKeys = function () { scanVisible('scan'); };
  }

  function installObserver() {
    if (window.__vitoPluggyObserverInstalled || !document.body || typeof MutationObserver !== 'function') return;
    window.__vitoPluggyObserverInstalled = true;
    var timer = null;
    var schedule = function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { scanVisible('auto_scan'); }, 280);
    };
    var obs = new MutationObserver(schedule);
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    setTimeout(function () { scanVisible('auto_scan'); }, 450);
  }

  if (document.body) {
    installObserver();
  } else {
    document.addEventListener('DOMContentLoaded', installObserver);
  }
})();
true;
`;

/**
 * Script injetado na WebView do widget Pluggy Connect (`connect.pluggy.ai`):
 * captura o `itemId` real via eventos `postMessage` ou resposta JSON de `/items`
 * para não depender de `GET /items` (403 em contas gratuitas da Pluggy).
 */
export const PLUGGY_CONNECT_BRIDGE_SCRIPT = `
(function () {
  if (!window.location || window.location.hostname.toLowerCase().indexOf('pluggy.ai') === -1) return true;
  if (window.__vitoPluggyConnectInstalled) return true;
  window.__vitoPluggyConnectInstalled = true;

  var UUID_EXACT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function postItem(itemId, status, source) {
    try {
      if (!UUID_EXACT.test(String(itemId || '').trim())) return;
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'pluggy_connect_item',
          itemId: String(itemId).trim(),
          status: typeof status === 'string' ? status : '',
          source: source
        }));
      }
    } catch (_) {}
  }

  function inspectConnectPayload(obj, source, urlHint) {
    if (!obj || typeof obj !== 'object') return;
    if (obj.item && typeof obj.item === 'object' && UUID_EXACT.test(String(obj.item.id || ''))) {
      postItem(obj.item.id, obj.item.status, source);
      return;
    }
    if (obj.data && obj.data.item && typeof obj.data.item === 'object' && UUID_EXACT.test(String(obj.data.item.id || ''))) {
      postItem(obj.data.item.id, obj.data.item.status, source);
      return;
    }
    if (typeof obj.itemId === 'string' && UUID_EXACT.test(obj.itemId)) {
      postItem(obj.itemId, obj.status, source);
      return;
    }
    var fromItemsApi = urlHint && urlHint.indexOf('/items') !== -1;
    if ((fromItemsApi || obj.connector) && typeof obj.id === 'string' && UUID_EXACT.test(obj.id)) {
      postItem(obj.id, obj.status, source);
    }
  }

  window.addEventListener('message', function (ev) {
    try {
      var d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
      inspectConnectPayload(d, 'postmessage', '');
    } catch (_) {}
  });

  if (typeof window.fetch === 'function') {
    var origFetch = window.fetch.bind(window);
    window.fetch = function (input) {
      var reqUrl = typeof input === 'string' ? input : (input && input.url) || '';
      var p = origFetch.apply(window, arguments);
      try {
        if (reqUrl.indexOf('/items') !== -1) {
          p.then(function (res) {
            try {
              if (!res || typeof res.clone !== 'function') return;
              res.clone().json().then(function (json) {
                inspectConnectPayload(json, 'network', reqUrl);
              }).catch(function () {});
            } catch (_) {}
          }).catch(function () {});
        }
      } catch (_) {}
      return p;
    };
  }
})();
true;
`;
