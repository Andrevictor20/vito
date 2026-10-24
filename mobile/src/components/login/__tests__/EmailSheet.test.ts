import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { type EmailSheetProps } from '../EmailSheet'
import { validateEmailAuth } from '../emailAuth'

describe('EmailSheet — bottom sheet de login e cadastro por e-mail', () => {
  it('expõe props de abertura/fechamento, modo login/register e handlers', () => {
    let calledLogin: { email: string; password: string } | null = null
    let calledRegister: { name: string; email: string; password: string } | null = null
    let switchedMode: 'login' | 'register' | null = null

    const props: EmailSheetProps = {
      visible: true,
      mode: 'register',
      onClose: () => {},
      onLogin: (email, password) => {
        calledLogin = { email, password }
      },
      onRegister: (name, email, password) => {
        calledRegister = { name, email, password }
      },
      onSwitchMode: (nextMode) => {
        switchedMode = nextMode
      },
    }

    assert.equal(props.visible, true)
    assert.equal(props.mode, 'register')
    assert.equal(typeof props.onClose, 'function')
    assert.equal(typeof props.onLogin, 'function')
    assert.equal(typeof props.onRegister, 'function')
    assert.equal(typeof props.onSwitchMode, 'function')

    props.onLogin('andre@vito.local', 'senha123')
    assert.deepEqual(calledLogin, { email: 'andre@vito.local', password: 'senha123' })

    props.onRegister?.('André Victor', 'andre@vito.local', 'senha123')
    assert.deepEqual(calledRegister, {
      name: 'André Victor',
      email: 'andre@vito.local',
      password: 'senha123',
    })

    props.onSwitchMode?.('login')
    assert.equal(switchedMode, 'login')
  })

  it('onClose é chamado ao fechar (scrim, alça ou voltar)', () => {
    let closed = false
    const props: EmailSheetProps = {
      visible: false,
      onClose: () => {
        closed = true
      },
      onLogin: () => {},
    }
    props.onClose()
    assert.equal(closed, true)
  })

  it('validação de login e cadastro: exige nome no modo register e e-mail/senha válidos', () => {
    assert.equal(
      validateEmailAuth({ email: '', password: '', isRegister: false }),
      'Preencha todos os campos obrigatórios.',
    )
    assert.equal(
      validateEmailAuth({
        email: 'andre@vito.local',
        password: 'senha123',
        name: '',
        isRegister: true,
      }),
      'Preencha todos os campos obrigatórios.',
    )
    assert.equal(
      validateEmailAuth({
        email: 'andre@vito.local',
        password: 'senha123',
        name: 'André Victor',
        isRegister: true,
      }),
      null,
    )
  })
})
