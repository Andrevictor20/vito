import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEMO_SCENES,
  DEMO_SCENE_COUNT,
  demoSceneById,
  nextSceneIndex,
  type DemoScene,
} from '../demoScenes'

describe('demoScenes — dados das seis cenas da demonstração', () => {
  it('deve conter exatamente seis cenas, na ordem de login-vito.html', () => {
    assert.equal(DEMO_SCENE_COUNT, 6)
    assert.equal(DEMO_SCENES.length, 6)
    assert.equal(DEMO_SCENES[0].id, 'dentista')
    assert.equal(DEMO_SCENES[1].id, 'emails')
    assert.equal(DEMO_SCENES[2].id, 'voo-rio')
    assert.equal(DEMO_SCENES[3].id, 'isa-whatsapp')
    assert.equal(DEMO_SCENES[4].id, 'escrever-email')
    assert.equal(DEMO_SCENES[5].id, 'boleto')
  })

  it('cena 1 — dentista: agenda + check', () => {
    const s = DEMO_SCENES[0]
    assert.equal(s.headline, 'organizar a agenda')
    assert.equal(s.tone, 'blue')
    assert.equal(s.userText, 'Dentista terça às 15h')
    assert.equal(s.vitoText, 'Marcado. Sem conflitos na sua agenda.')
    assert.equal(s.card.kind, 'agenda')
    assert.equal(s.card.title, 'Dentista')
    assert.equal(s.card.subtitle, 'Terça, 15:00 · Google Agenda')
    assert.equal(s.card.trailing, 'check')
    assert.equal(s.photo, undefined)
  })

  it('cena 2 — emails: ler seus e-mails + tag Urgente', () => {
    const s = DEMO_SCENES[1]
    assert.equal(s.headline, 'ler seus e-mails')
    assert.equal(s.tone, 'red')
    assert.equal(s.userText, 'Tem e-mail importante hoje?')
    assert.equal(s.vitoText, '3 novos. O da Ana pede resposta até hoje.')
    assert.equal(s.card.kind, 'email')
    assert.equal(s.card.title, 'Ana Souza · Proposta')
    assert.equal(s.card.subtitle, 'Pede resposta hoje · Gmail')
    assert.equal(s.card.trailing, 'tag')
    assert.equal(s.card.tagLabel, 'Urgente')
  })

  it('cena 3 — voo Rio: radar + gráfico sparkline', () => {
    const s = DEMO_SCENES[2]
    assert.equal(s.headline, 'monitorar preços')
    assert.equal(s.tone, 'orange')
    assert.equal(s.userText, 'Me avisa se o voo pro Rio baixar de R$ 600')
    assert.equal(s.vitoText, 'Radar criado. Eu confiro todo dia.')
    assert.equal(s.card.kind, 'radar')
    assert.equal(s.card.title, 'Voo para o Rio')
    assert.equal(s.card.subtitle, 'Hoje R$ 742 · alerta abaixo de R$ 600')
    assert.equal(s.card.trailing, 'chart')
  })

  it('cena 4 — Isa WhatsApp: card col com balão verde + pílulas Enviar/Editar', () => {
    const s = DEMO_SCENES[3]
    assert.equal(s.headline, 'cuidar do WhatsApp')
    assert.equal(s.tone, 'acc')
    assert.equal(s.userText, 'Responde a Isa que chego às 19h')
    assert.equal(s.vitoText, 'Rascunho pronto. Quer que eu envie?')
    assert.equal(s.card.kind, 'whatsapp')
    assert.equal(s.card.title, 'Para Isa · WhatsApp')
    assert.equal(s.card.bubbleText, 'Oi! Chego às 19h.')
    assert.equal(s.card.trailing, 'pills')
    assert.equal(s.card.isCol, true)
  })

  it('cena 5 — Escrever e-mail: card col com balão vermelho + pílulas Enviar/Editar', () => {
    const s = DEMO_SCENES[4]
    assert.equal(s.headline, 'escrever e-mails')
    assert.equal(s.tone, 'red')
    assert.equal(s.userText, 'Escreve pro Carlos confirmando a reunião de quinta')
    assert.equal(s.vitoText, 'Rascunho pronto no seu Gmail.')
    assert.equal(s.card.kind, 'email-draft')
    assert.equal(s.card.title, 'Para Carlos · E-mail')
    assert.equal(s.card.bubbleTitle, 'Confirmação da reunião')
    assert.equal(s.card.bubbleText, 'Oi Carlos, confirmo nossa reunião de quinta às 10h.')
    assert.equal(s.card.trailing, 'pills')
    assert.equal(s.card.isCol, true)
  })

  it('cena 6 — boleto: chip roxo + tag Tarefa + foto', () => {
    const s = DEMO_SCENES[5]
    assert.equal(s.headline, 'não perder prazos')
    assert.equal(s.tone, 'purple')
    assert.equal(s.userText, 'Paga esse boleto até sexta')
    assert.equal(s.vitoText, 'Li o boleto e criei a tarefa.')
    assert.equal(s.card.kind, 'boleto')
    assert.equal(s.card.title, 'Pagar boleto · R$ 248,90')
    assert.equal(s.card.subtitle, 'Vence sexta · prioridade alta')
    assert.equal(s.card.trailing, 'tag')
    assert.equal(s.card.tagLabel, 'Tarefa')
    assert.equal(s.photo, true)
  })

  it('demoSceneById retorna a cena correta e undefined para id inexistente', () => {
    assert.equal(demoSceneById('voo-rio')?.id, 'voo-rio')
    assert.equal(demoSceneById('emails')?.id, 'emails')
    assert.equal(demoSceneById('nao-existe'), undefined)
  })

  it('nextSceneIndex avança e volta ao zero após a última (6 cenas)', () => {
    assert.equal(nextSceneIndex(0), 1)
    assert.equal(nextSceneIndex(1), 2)
    assert.equal(nextSceneIndex(2), 3)
    assert.equal(nextSceneIndex(3), 4)
    assert.equal(nextSceneIndex(4), 5)
    assert.equal(nextSceneIndex(5), 0)
  })

  it('toda cena tem campos obrigatórios preenchidos', () => {
    for (const s of DEMO_SCENES) {
      assert.ok(s.id, 'id')
      assert.ok(s.userText, 'userText')
      assert.ok(s.vitoText, 'vitoText')
      assert.ok(s.card.title, 'card.title')
      assert.ok(
        ['agenda', 'email', 'radar', 'whatsapp', 'email-draft', 'tarefa', 'boleto'].includes(
          s.card.kind,
        ),
        'card.kind válido',
      )
    }
  })
})
