import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateEmailAuth,
  normalizeEmail,
  mapGoogleAuthError,
  mapNetworkAuthError,
} from '../emailAuth'

describe('emailAuth — contrato dos fluxos de e-mail e Google', () => {
  it('rejeita campos vazios, e-mail inválido e senha curta', () => {
    assert.equal(
      validateEmailAuth({ email: '', password: '', isRegister: false }),
      'Preencha todos os campos obrigatórios.',
    )
    assert.equal(
      validateEmailAuth({
        email: 'andre',
        password: '123456',
        isRegister: false,
      }),
      'Informe um endereço de e-mail válido.',
    )
    assert.equal(
      validateEmailAuth({
        email: 'andre@vito.local',
        password: '123',
        isRegister: false,
      }),
      'A senha deve ter no mínimo 6 caracteres.',
    )
    assert.equal(
      validateEmailAuth({
        email: 'andre@vito.local',
        password: 'senha123',
        isRegister: true,
        name: '',
      }),
      'Preencha todos os campos obrigatórios.',
    )
    assert.equal(
      validateEmailAuth({
        email: '  Andre@Vito.local  ',
        password: 'senha123',
        isRegister: false,
      }),
      null,
    )
  })

  it('normaliza e-mail em minúsculas sem espaços', () => {
    assert.equal(normalizeEmail('  Andre@Vito.local '), 'andre@vito.local')
  })

  it('silencia cancelamento do Google e traduz erros conhecidos', () => {
    assert.equal(mapGoogleAuthError('Login com Google cancelado.'), null)
    assert.equal(mapGoogleAuthError('Login com Google já em andamento.'), null)
    assert.ok(
      mapGoogleAuthError('não retornou token de identificação')?.includes(
        'SHA-1',
      ),
    )
    assert.equal(
      mapGoogleAuthError('Falha no login com Google nativo: audience inválida'),
      'Erro do servidor: audience inválida',
    )
  })

  it('traduz falha de rede para o host conhecido', () => {
    assert.equal(
      mapNetworkAuthError('Network request failed', 'vito.rasppi.cloud'),
      'Falha ao conectar no servidor (vito.rasppi.cloud). Verifique sua conexão com a internet.',
    )
    assert.equal(mapNetworkAuthError('senha inválida', 'x'), 'senha inválida')
  })
})
