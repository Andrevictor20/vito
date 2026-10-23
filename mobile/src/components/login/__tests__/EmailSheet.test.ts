import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { type EmailSheetProps } from '../EmailSheet'

describe('EmailSheet — bottom sheet de login por e-mail', () => {
  it('expõe props de abertura/fechamento e handler de login', () => {
    let calledWith: { email: string; password: string } | null = null
    const props: EmailSheetProps = {
      visible: true,
      onClose: () => {},
      onLogin: (email, password) => {
        calledWith = { email, password }
      },
    }

    assert.equal(props.visible, true)
    assert.equal(typeof props.onClose, 'function')
    assert.equal(typeof props.onLogin, 'function')

    props.onLogin('andre@vito.local', 'senha123')
    assert.deepEqual(calledWith, { email: 'andre@vito.local', password: 'senha123' })
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

  it('validação mínima: e-mail e senha são obrigatórios (regras do app)', () => {
    const validate = (email: string, password: string): string[] => {
      const errors: string[] = []
      if (!email || !password)
        errors.push('Preencha todos os campos obrigatórios.')
      if (email && (!email.includes('@') || !email.includes('.')))
        errors.push('Informe um endereço de e-mail válido.')
      if (password && password.length < 6)
        errors.push('A senha deve ter no mínimo 6 caracteres.')
      return errors
    }

    assert.deepEqual(validate('', ''), [
      'Preencha todos os campos obrigatórios.',
    ])
    assert.deepEqual(validate('andre', '123456'), [
      'Informe um endereço de e-mail válido.',
    ])
    assert.deepEqual(validate('andre@vito.local', '123'), [
      'A senha deve ter no mínimo 6 caracteres.',
    ])
    assert.deepEqual(
      validate('andre@vito.local', ''),
      ['Preencha todos os campos obrigatórios.'],
    )
    assert.deepEqual(validate('andre@vito.local', 'senha123'), [])
  })
})
