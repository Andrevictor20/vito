import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getMobileDeviceName, IN_APP_BROWSER_OPTIONS } from './platformInfo';
import { AuthApi } from '../services/api/authApi';
import { ApiClient } from '../services/api/client';

describe('PlatformInfo & In-App Browser Options Unit Tests', () => {
  test('getMobileDeviceName retorna identificação precisa de dispositivo móvel', () => {
    const name = getMobileDeviceName();
    assert.ok(typeof name === 'string' && name.length > 0);
    assert.ok(
      name.includes('Android') ||
      name.includes('iPhone') ||
      name.includes('iOS') ||
      name.includes('Celular'),
      `Nome do dispositivo deve indicar plataforma móvel, obteve: ${name}`
    );
  });

  test('IN_APP_BROWSER_OPTIONS configura Custom Tabs estritamente contido no app (sem navegador externo)', () => {
    assert.equal(IN_APP_BROWSER_OPTIONS.toolbarColor, '#0B0D10');
    assert.equal(IN_APP_BROWSER_OPTIONS.secondaryToolbarColor, '#14171C');
    assert.equal(IN_APP_BROWSER_OPTIONS.controlsColor, '#FFFFFF');
    // Android: não cria nova task nem janela nos recentes do sistema
    assert.equal(IN_APP_BROWSER_OPTIONS.createTask, false);
    assert.equal(IN_APP_BROWSER_OPTIONS.useProxyActivity, false);
    assert.equal(IN_APP_BROWSER_OPTIONS.showInRecents, false);
    assert.equal(IN_APP_BROWSER_OPTIONS.enableDefaultShareMenuItem, false);
    // iOS: PageSheet modal deslizante nativo
    assert.equal(IN_APP_BROWSER_OPTIONS.presentationStyle, 'pageSheet');
    assert.equal(IN_APP_BROWSER_OPTIONS.dismissButtonStyle, 'close');
  });

  test('AuthApi utiliza getMobileDeviceName por padrão em login e register quando não especificado', async () => {
    let capturedBodyLogin: any = null;
    let capturedBodyRegister: any = null;

    const mockClient = {
      request: async (ep: string, opt?: any) => {
        if (ep === '/api/v1/auth/login') {
          capturedBodyLogin = JSON.parse(opt?.body || '{}');
          return { token: 'tok_login', access_token: 'tok_login', refresh_token: 'ref_1', session_id: 's_1' };
        }
        if (ep === '/api/v1/auth/register') {
          capturedBodyRegister = JSON.parse(opt?.body || '{}');
          return { token: 'tok_reg', access_token: 'tok_reg', refresh_token: 'ref_2', session_id: 's_2' };
        }
        return {};
      },
      setAuthTokens: async () => {},
      setToken: async () => {},
    } as unknown as ApiClient;

    const api = new AuthApi(mockClient);

    await api.login('usuario@vito.app', 'senha123');
    assert.ok(capturedBodyLogin?.device_name, 'login deve conter device_name');
    assert.equal(capturedBodyLogin.device_name, getMobileDeviceName());

    await api.register('Novo Usuário', 'novo@vito.app', 'senha123');
    assert.ok(capturedBodyRegister?.device_name, 'register deve conter device_name');
    assert.equal(capturedBodyRegister.device_name, getMobileDeviceName());
  });
});
