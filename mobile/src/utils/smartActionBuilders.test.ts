import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAgendaSmartActions,
  buildTaskSmartActions,
  buildTriggerSmartActions,
  buildBookingSmartActions,
  formatEventSubtitle,
  type SmartActionItem,
} from './smartActionBuilders';

describe('smartActionBuilders — Gerador de ações contextuais inteligentes (Vito Mobile)', () => {
  describe('Agenda (Events)', () => {
    it('deve formatar o subtítulo do evento com horário de início, término e fonte', () => {
      const subtitle = formatEventSubtitle({
        title: 'Aula de inglês',
        start_at: '2026-10-31T08:00:00Z',
        end_at: '2026-10-31T11:15:00Z',
        source: 'Google',
      });
      assert.ok(subtitle.includes('Google'));

      const allDay = formatEventSubtitle({
        title: 'Feriado',
        category: 'holiday',
        source: 'Brasil',
      });
      assert.equal(allDay, 'Dia inteiro • Brasil');
    });
    it('deve gerar ações inteligentes de reagendamento, adiar, resumo e cancelamento para eventos', () => {
      let promptSent = '';
      let cancelSent = '';
      let editClicked = false;

      const actions = buildAgendaSmartActions(
        { id: 'ev-1', title: 'Aula de inglês', start_time: '2026-10-31T08:00:00Z' },
        {
          onAskVitoReschedule: (p) => { promptSent = p; },
          onAskVitoMoveTomorrow: (p) => { promptSent = p; },
          onAskVitoBriefing: (p) => { promptSent = p; },
          onAskVitoCancel: (p) => { cancelSent = p; },
          onEditDirectly: () => { editClicked = true; },
        }
      );

      assert.equal(actions.length, 5);

      // 1. Reagendar com Vito (IA)
      assert.equal(actions[0].id, 'reschedule');
      assert.equal(actions[0].variant, 'ai');
      assert.equal(actions[0].icon, 'auto-awesome');
      actions[0].onPress();
      assert.ok(promptSent.includes('Aula de inglês'));

      // 2. Adiar para amanhã
      assert.equal(actions[1].id, 'move_tomorrow');
      actions[1].onPress();
      assert.ok(promptSent.includes('amanhã'));

      // 3. Resumo e preparação (IA)
      assert.equal(actions[2].id, 'briefing');
      assert.equal(actions[2].variant, 'ai');
      actions[2].onPress();
      assert.ok(promptSent.includes('me preparar'));

      // 4. Edição direta
      assert.equal(actions[3].id, 'edit_details');
      actions[3].onPress();
      assert.equal(editClicked, true);

      // 5. Cancelar evento (Destrutivo)
      assert.equal(actions[4].id, 'cancel');
      assert.equal(actions[4].variant, 'destructive');
      actions[4].onPress();
      assert.ok(cancelSent.includes('Cancela Aula de inglês'));
    });
  });

  describe('Tasks & Todos', () => {
    it('deve gerar ações para concluir tarefa em aberto, mover com IA, decompor e excluir', () => {
      let toggled = false;
      let promptSent = '';
      let deleted = false;

      const actions = buildTaskSmartActions(
        { id: 'todo-1', title: 'Comprar café', isCompleted: false, kind: 'todo' },
        {
          onToggleComplete: () => { toggled = true; },
          onAskVitoReschedule: (p) => { promptSent = p; },
          onAskVitoBreakdown: (p) => { promptSent = p; },
          onDelete: () => { deleted = true; },
        }
      );

      assert.equal(actions.length, 4);

      // 1. Toggle Complete
      assert.equal(actions[0].id, 'toggle_complete');
      assert.equal(actions[0].title, 'Marcar como concluída');
      assert.equal(actions[0].icon, 'check-circle');
      actions[0].onPress();
      assert.equal(toggled, true);

      // 2. Mover com IA
      assert.equal(actions[1].id, 'reschedule');
      assert.equal(actions[1].variant, 'ai');
      actions[1].onPress();
      assert.ok(promptSent.includes('Comprar café'));

      // 3. Decompor em passos (IA)
      assert.equal(actions[2].id, 'breakdown');
      assert.equal(actions[2].variant, 'ai');
      actions[2].onPress();
      assert.ok(promptSent.includes('passos práticos'));

      // 4. Excluir
      assert.equal(actions[3].id, 'delete');
      assert.equal(actions[3].variant, 'destructive');
      actions[3].onPress();
      assert.equal(deleted, true);
    });

    it('deve exibir "Reabrir tarefa" se a tarefa já estiver concluída', () => {
      const actions = buildTaskSmartActions(
        { id: 'todo-2', title: 'Enviar relatório', isCompleted: true, kind: 'todo' },
        {
          onToggleComplete: () => {},
          onAskVitoReschedule: () => {},
          onAskVitoBreakdown: () => {},
          onDelete: () => {},
        }
      );

      assert.equal(actions[0].title, 'Reabrir tarefa');
      assert.equal(actions[0].icon, 'undo');
    });
  });

  describe('Triggers (Vigílias / Radares)', () => {
    it('deve gerar ações inteligentes para pausar vigília ativa, checagem instantânea, ajustar e excluir', () => {
      let toggleCalled = false;
      let promptSent = '';

      const actions = buildTriggerSmartActions(
        { id: 'trig-1', title: 'Preço passagem SP-RJ', status: 'active' },
        {
          onToggleStatus: () => { toggleCalled = true; },
          onAskVitoChangeSchedule: (p) => { promptSent = p; },
          onAskVitoInstantCheck: (p) => { promptSent = p; },
          onAskVitoDelete: (p) => { promptSent = p; },
        }
      );

      assert.equal(actions.length, 4);

      // 1. Pausar vigília
      assert.equal(actions[0].id, 'toggle_status');
      assert.equal(actions[0].title, 'Pausar vigília');
      actions[0].onPress();
      assert.equal(toggleCalled, true);

      // 2. Checar agora (IA)
      assert.equal(actions[1].id, 'instant_check');
      assert.equal(actions[1].variant, 'ai');
      actions[1].onPress();
      assert.ok(promptSent.includes('checagem agora'));

      // 3. Mudar horário
      assert.equal(actions[2].id, 'change_schedule');
      actions[2].onPress();
      assert.ok(promptSent.includes('ajustar a checagem'));

      // 4. Excluir
      assert.equal(actions[3].id, 'delete');
      assert.equal(actions[3].variant, 'destructive');
      actions[3].onPress();
      assert.ok(promptSent.includes('realmente excluir'));
    });

    it('deve exibir "Retomar vigília" se o radar estiver pausado', () => {
      const actions = buildTriggerSmartActions(
        { id: 'trig-2', title: 'Ofertas Notebook', status: 'paused' },
        {
          onToggleStatus: () => {},
          onAskVitoChangeSchedule: () => {},
          onAskVitoInstantCheck: () => {},
          onAskVitoDelete: () => {},
        }
      );

      assert.equal(actions[0].title, 'Retomar vigília');
      assert.equal(actions[0].icon, 'play-circle-outline');
    });
  });

  describe('Booking & Meetings', () => {
    it('deve gerar ações de copiar link, ajustar com IA, duplicar e excluir', () => {
      let copyCalled = false;
      let promptSent = '';
      let deleted = false;

      const actions = buildBookingSmartActions(
        { id: 'bt-1', title: 'Mentoria 30 min' },
        'type',
        {
          onCopyLink: () => { copyCalled = true; },
          onAskVitoCustomize: (p) => { promptSent = p; },
          onAskVitoDuplicate: (p) => { promptSent = p; },
          onDelete: () => { deleted = true; },
        }
      );

      assert.equal(actions.length, 4);

      // 1. Copiar link
      assert.equal(actions[0].id, 'copy_link');
      actions[0].onPress();
      assert.equal(copyCalled, true);

      // 2. Personalizar com IA
      assert.equal(actions[1].id, 'customize');
      assert.equal(actions[1].variant, 'ai');
      actions[1].onPress();
      assert.ok(promptSent.includes('Mentoria 30 min'));

      // 3. Duplicar link
      assert.equal(actions[2].id, 'duplicate');
      actions[2].onPress();
      assert.ok(promptSent.includes('baseado em "Mentoria 30 min"'));

      // 4. Excluir
      assert.equal(actions[3].id, 'delete');
      assert.equal(actions[3].variant, 'destructive');
      actions[3].onPress();
      assert.equal(deleted, true);
    });
  });
});
