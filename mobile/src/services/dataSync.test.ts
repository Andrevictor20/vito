import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DataSyncBus, SyncEventType, tabNavigationBus, chatPromptBus } from './dataSync';

describe('DataSyncBus - Reatividade e Barramento Bidirecional (TDD)', () => {
  it('notifica subscribers específicos e genéricos quando evento específico é disparado', () => {
    const bus = new DataSyncBus();
    let todosNotified = 0;
    let allNotified = 0;
    let eventsNotified = 0;

    bus.subscribe('refresh_todos', () => {
      todosNotified++;
    });
    bus.subscribe('refresh_all', () => {
      allNotified++;
    });
    bus.subscribe('refresh_events', () => {
      eventsNotified++;
    });

    bus.notify('refresh_todos');

    assert.equal(todosNotified, 1, 'Subscriber de refresh_todos deve ser acionado');
    assert.equal(allNotified, 1, 'Subscriber de refresh_all deve ser acionado');
    assert.equal(eventsNotified, 0, 'Subscriber de refresh_events NÃO deve ser acionado');
  });

  it('notifica subscribers específicos quando refresh_all é disparado (propagação global)', () => {
    const bus = new DataSyncBus();
    let todosNotified = 0;
    let eventsNotified = 0;
    let triggersNotified = 0;
    let allNotified = 0;

    bus.subscribe('refresh_todos', () => {
      todosNotified++;
    });
    bus.subscribe('refresh_events', () => {
      eventsNotified++;
    });
    bus.subscribe('refresh_triggers', () => {
      triggersNotified++;
    });
    bus.subscribe('refresh_all', () => {
      allNotified++;
    });

    bus.notify('refresh_all');

    assert.equal(allNotified, 1, 'refresh_all listener deve ser chamado');
    assert.equal(todosNotified, 1, 'refresh_todos deve ser chamado quando refresh_all dispara');
    assert.equal(eventsNotified, 1, 'refresh_events deve ser chamado quando refresh_all dispara');
    assert.equal(triggersNotified, 1, 'refresh_triggers deve ser chamado quando refresh_all dispara');
  });

  it('permite cancelar a inscrição via retorno do subscribe', () => {
    const bus = new DataSyncBus();
    let callCount = 0;
    const unsub = bus.subscribe('refresh_todos', () => {
      callCount++;
    });

    bus.notify('refresh_todos');
    assert.equal(callCount, 1);

    unsub();
    bus.notify('refresh_todos');
    assert.equal(callCount, 1, 'Listener removido não deve ser invocado novamente');
  });

  it('não quebra a cadeia se um callback lançar exceção', () => {
    const bus = new DataSyncBus();
    let secondRan = false;

    bus.subscribe('refresh_todos', () => {
      throw new Error('Falha simulada');
    });
    bus.subscribe('refresh_todos', () => {
      secondRan = true;
    });

    assert.doesNotThrow(() => {
      bus.notify('refresh_todos');
    });
    assert.equal(secondRan, true, 'Segundo listener deve rodar mesmo após erro do primeiro');
  });
});

describe('TabNavigationBus - Barramento de Navegação Lateral de Abas (TDD)', () => {
  it('notifica ouvintes quando uma aba é selecionada', () => {
    let targetTab: string | null = null;
    const unsub = tabNavigationBus.subscribe((tab) => {
      targetTab = tab;
    });

    tabNavigationBus.notify('triggers');
    assert.equal(targetTab, 'triggers');

    tabNavigationBus.notify('chat');
    assert.equal(targetTab, 'chat');

    unsub();
    tabNavigationBus.notify('tasks');
    assert.equal(targetTab, 'chat', 'Listener cancelado não deve receber novos eventos');
  });

  it('não quebra a execução se um subscriber lançar erro', () => {
    let secondRan = false;
    const unsub1 = tabNavigationBus.subscribe(() => {
      throw new Error('Erro simulado');
    });
    const unsub2 = tabNavigationBus.subscribe(() => {
      secondRan = true;
    });

    assert.doesNotThrow(() => {
      tabNavigationBus.notify('booking');
    });
    assert.equal(secondRan, true);

    unsub1();
    unsub2();
  });
});

describe('ChatPromptBus - Barramento de Perguntas Proativas e Prompts do Chat (TDD)', () => {
  it('notifica ouvintes com pergunta contextual ao chamar askAssistant', () => {
    let receivedPayload: any = null;
    const unsub = chatPromptBus.subscribe((payload) => {
      receivedPayload = payload;
    });

    chatPromptBus.askAssistant('Qual próxima tarefa você quer organizar?');

    assert.ok(receivedPayload);
    assert.equal(typeof receivedPayload, 'object');
    assert.equal(receivedPayload.question, 'Qual próxima tarefa você quer organizar?');

    unsub();
  });

  it('notifica ouvintes com string ao chamar notify diretamente', () => {
    let receivedPayload: any = null;
    const unsub = chatPromptBus.subscribe((payload) => {
      receivedPayload = payload;
    });

    chatPromptBus.notify('Prompt direto');

    assert.equal(receivedPayload, 'Prompt direto');
    unsub();
  });
});

