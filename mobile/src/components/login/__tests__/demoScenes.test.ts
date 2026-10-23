import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEMO_SCENES,
  DEMO_SCENE_COUNT,
  demoSceneById,
  nextSceneIndex,
  type DemoScene,
} from '../demoScenes'

describe('demoScenes — dados das quatro cenas da demonstração', () => {
  it('deve conter exatamente quatro cenas, na ordem do protótipo', () => {
    assert.equal(DEMO_SCENE_COUNT, 4)
    assert.equal(DEMO_SCENES.length, 4)
    assert.equal(DEMO_SCENES[0].id, 'dentista')
    assert.equal(DEMO_SCENES[1].id, 'voo-rio')
    assert.equal(DEMO_SCENES[2].id, 'isa-whatsapp')
    assert.equal(DEMO_SCENES[3].id, 'boleto')
  })

  it('cena 1 — dentista: agenda + check', () => {
    const s = DEMO_SCENES[0]
    assert.equal(s.userText, 'Dentista terça às 15h')
    assert.equal(s.vitoText, 'Marcado. Sem conflitos na sua agenda.')
    assert.equal(s.card.kind, 'agenda')
    assert.equal(s.card.title, 'Dentista')
    assert.equal(s.card.subtitle, 'Terça, 15:00 · Google Agenda')
    assert.equal(s.card.trailing, 'check')
    assert.equal(s.photo, undefined)
  })

  it('cena 2 — voo Rio: radar + gráfico', () => {
    const s = DEMO_SCENES[1]
    assert.equal(s.userText, 'Me avisa se o voo pro Rio baixar de R$ 600')
    assert.equal(s.vitoText, 'Radar criado. Eu confiro todo dia.')
    assert.equal(s.card.kind, 'radar')
    assert.equal(s.card.title, 'Voo para o Rio')
    assert.equal(s.card.subtitle, 'Hoje R$ 742 · alerta abaixo de R$ 600')
    assert.equal(s.card.trailing, 'chart')
  })

  it('cena 3 — Isa WhatsApp: pílulas Enviar/Editar', () => {
    const s = DEMO_SCENES[2]
    assert.equal(s.userText, 'Responde a Isa que chego às 19h')
    assert.equal(s.vitoText, 'Rascunho pronto. Quer que eu envie?')
    assert.equal(s.card.kind, 'tarefa')
    assert.equal(s.card.title, 'Resposta para Isa · WhatsApp')
    assert.equal(s.card.subtitle, 'Oi! Chego às 19h.')
    assert.equal(s.card.trailing, 'pills')
  })

  it('cena 4 — boleto: chip verde + tag Tarefa + foto', () => {
    const s = DEMO_SCENES[3]
    assert.equal(s.userText, 'Paga esse boleto até sexta')
    assert.equal(s.vitoText, 'Li o boleto e criei a tarefa.')
    assert.equal(s.card.kind, 'boleto')
    assert.equal(s.card.title, 'Pagar boleto · R$ 248,90')
    assert.equal(s.card.subtitle, 'Vence sexta · prioridade alta')
    assert.equal(s.card.trailing, 'tag')
    assert.equal(s.photo, true)
  })

  it('demoSceneById retorna a cena correta e undefined para id inexistente', () => {
    assert.equal(demoSceneById('voo-rio')?.id, 'voo-rio')
    assert.equal(demoSceneById('nao-existe'), undefined)
  })

  it('nextSceneIndex avança e volta ao zero após a última', () => {
    assert.equal(nextSceneIndex(0), 1)
    assert.equal(nextSceneIndex(1), 2)
    assert.equal(nextSceneIndex(2), 3)
    assert.equal(nextSceneIndex(3), 0)
  })

  it('toda cena tem campos obrigatórios preenchidos', () => {
    for (const s of DEMO_SCENES) {
      assert.ok(s.id, 'id')
      assert.ok(s.userText, 'userText')
      assert.ok(s.vitoText, 'vitoText')
      assert.ok(s.card.title, 'card.title')
      assert.ok(s.card.subtitle, 'card.subtitle')
      assert.ok(
        ['agenda', 'radar', 'tarefa', 'boleto'].includes(s.card.kind),
        'card.kind válido',
      )
      assert.ok(
        ['check', 'chart', 'pills', 'tag'].includes(s.card.trailing),
        'card.trailing válido',
      )
    }
  })
})
