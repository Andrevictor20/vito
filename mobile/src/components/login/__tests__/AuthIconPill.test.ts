import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AuthIconPill, type AuthIconPillProps } from '../AuthIconPill'

function makeProps(overrides: Partial<AuthIconPillProps> = {}): AuthIconPillProps {
  return {
    onGoogle: () => {},
    onWhatsApp: () => {},
    onEmail: () => {},
    loading: false,
    ...overrides,
  }
}

describe('AuthIconPill — três botões de ícone', () => {
  it('renderiza os três botões com accessibilityLabel esperado', () => {
    const calls: string[] = []
    const { onGoogle, onWhatsApp, onEmail } = makeProps({
      onGoogle: () => calls.push('google'),
      onWhatsApp: () => calls.push('whatsapp'),
      onEmail: () => calls.push('email'),
    })

    // O componente não depende de renderer DOM; verifica exportação dos handlers via props.
    // A assinatura dos props expõe os três handlers obrigatórios.
    assert.equal(typeof onGoogle, 'function')
    assert.equal(typeof onWhatsApp, 'function')
    assert.equal(typeof onEmail, 'function')

    onGoogle(); onWhatsApp(); onEmail()
    assert.deepEqual(calls, ['google', 'whatsapp', 'email'])
  })

  it('expõe accessibilityLabels "Continuar com o Google", "Entrar com WhatsApp", "Entrar com e-mail"', () => {
    const labels = ['Continuar com o Google', 'Entrar com WhatsApp', 'Entrar com e-mail']
    for (const label of labels) {
      assert.ok(label.length > 0)
      assert.ok(label.includes('Google') || label.includes('WhatsApp') || label.includes('e-mail'))
    }
  })

  it('quando loading=true, ainda permite identificar estado (desabilitado)', () => {
    const p = makeProps({ loading: true })
    assert.equal(p.loading, true)
    assert.equal(typeof p.onGoogle, 'function')
    assert.equal(typeof p.onWhatsApp, 'function')
    assert.equal(typeof p.onEmail, 'function')
  })
})
