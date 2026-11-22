import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEMO_HEADLINES,
  DEMO_SCENES,
  DEMO_SCENE_COUNT,
  demoSceneById,
  nextSceneIndex,
} from '../demoScenes'

describe('demoScenes — dados das seis cenas v5 da demonstração', () => {
  it('contém exatamente seis cenas canônicas na ordem de Vito-telas-atualizadas.html', () => {
    assert.equal(DEMO_SCENE_COUNT, 6)
    assert.equal(DEMO_SCENES.length, 6)
    assert.deepEqual(
      DEMO_HEADLINES,
      [
        'organizar a agenda',
        'controlar finanças',
        'automatizar rotinas',
        'cuidar do WhatsApp',
        'ler seus e-mails',
        'não perder prazos',
      ],
    )
    assert.equal(DEMO_SCENES[0].id, 'dentista')
    assert.equal(DEMO_SCENES[1].id, 'financas-uber')
    assert.equal(DEMO_SCENES[2].id, 'rotina-manha')
    assert.equal(DEMO_SCENES[3].id, 'isa-whatsapp')
    assert.equal(DEMO_SCENES[4].id, 'emails')
    assert.equal(DEMO_SCENES[5].id, 'boleto')
  })

  it('cena 1 — dentista: agenda + check', () => {
    const s = DEMO_SCENES[0]
    assert.equal(s.headline, 'organizar a agenda')
    assert.equal(s.tone, 'blue')
    assert.equal(s.userText, 'Dentista terça às 15h')
    assert.equal(s.vitoText, 'Marcado. Sem conflitos na sua agenda.')
    assert.equal(s.card.kind, 'agenda')
    assert.equal(s.card.trailing, 'check')
  })

  it('cena 2 — controlar finanças: Uber + R$ 212', () => {
    const s = DEMO_SCENES[1]
    assert.equal(s.headline, 'controlar finanças')
    assert.equal(s.tone, 'fin')
    assert.equal(s.userText, 'Quanto gastei com Uber esse mês?')
    assert.equal(s.vitoText, 'R$ 212,40 em 14 corridas (+18% vs média).')
    assert.equal(s.card.kind, 'finance')
    assert.equal(s.card.trailing, 'value')
    assert.equal(s.card.trailingValue, 'R$ 212')
  })

  it('cena 3 — automatizar rotinas: Resumo da manhã + Ativo', () => {
    const s = DEMO_SCENES[2]
    assert.equal(s.headline, 'automatizar rotinas')
    assert.equal(s.tone, 'orange')
    assert.equal(s.userText, 'Todo dia às 7h30, me manda um resumo do meu dia')
    assert.equal(s.card.kind, 'radar')
    assert.equal(s.card.title, 'Resumo da manhã')
    assert.equal(s.card.trailing, 'status')
    assert.equal(s.card.tagLabel, 'Ativo')
  })

  it('cena 4 — Isa WhatsApp: card col com balão verde', () => {
    const s = DEMO_SCENES[3]
    assert.equal(s.headline, 'cuidar do WhatsApp')
    assert.equal(s.tone, 'acc')
    assert.equal(s.userText, 'Responde a Isa que chego às 19h')
    assert.equal(s.vitoText, 'Rascunho pronto. Posso enviar?')
    assert.equal(s.card.kind, 'whatsapp')
    assert.equal(s.card.bubbleText, 'Oi! Chego às 19h.')
    assert.equal(s.card.isCol, true)
  })

  it('cena 5 — ler seus e-mails: Ana Souza + tag Urgente', () => {
    const s = DEMO_SCENES[4]
    assert.equal(s.headline, 'ler seus e-mails')
    assert.equal(s.tone, 'red')
    assert.equal(s.userText, 'Tem algum e-mail urgente hoje?')
    assert.equal(s.vitoText, 'Sim — Ana Souza pediu retorno na proposta.')
    assert.equal(s.card.kind, 'email')
    assert.equal(s.card.tagLabel, 'Urgente')
  })

  it('cena 6 — não perder prazos: boleto R$ 248,90 + check', () => {
    const s = DEMO_SCENES[5]
    assert.equal(s.headline, 'não perder prazos')
    assert.equal(s.tone, 'purple')
    assert.equal(s.userText, 'Lembra de pagar o boleto sexta')
    assert.equal(s.vitoText, 'Tarefa criada com lembrete às 9h.')
    assert.equal(s.card.kind, 'boleto')
    assert.equal(s.card.title, 'Pagar boleto · R$ 248,90')
    assert.equal(s.card.trailing, 'check')
  })

  it('demoSceneById e nextSceneIndex funcionam para todas as 6 cenas', () => {
    assert.equal(demoSceneById('financas-uber')?.id, 'financas-uber')
    assert.equal(demoSceneById('nao-existe'), undefined)
    for (let i = 0; i < 6; i += 1) {
      assert.equal(nextSceneIndex(i), (i + 1) % 6)
    }
  })
})
