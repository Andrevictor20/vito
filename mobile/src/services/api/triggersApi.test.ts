import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TriggersApi } from './triggersApi';
import { ApiClient } from './client';

describe('TriggersApi Unit Tests', () => {
  test('getTemplates consulta /api/v1/triggers/templates', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        return {
          templates: [
            {
              id: 'tmpl-career-jobs',
              title: 'Radar de Oportunidades & Vagas',
              area: 'carreiras',
              category: 'career',
            },
            {
              id: 'tmpl-concursos-editais',
              title: 'Vigília de Concursos Públicos',
              area: 'concursos',
              category: 'public_exams',
            },
          ],
        };
      },
    } as unknown as ApiClient;

    const api = new TriggersApi(client);
    const templates = await api.getTemplates();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].ep, '/api/v1/triggers/templates');
    assert.equal(templates.length, 2);
    assert.equal(templates[0].id, 'tmpl-career-jobs');
    assert.equal(templates[1].area, 'concursos');
  });

  test('activateTemplate envia POST para /api/v1/triggers/templates/:id/activate', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        return {
          id: 'trig-123',
          title: 'Meu Radar de Vagas',
          category: 'career',
          status: 'active',
        };
      },
    } as unknown as ApiClient;

    const api = new TriggersApi(client);
    const trigger = await api.activateTemplate('tmpl-career-jobs', {
      title: 'Meu Radar de Vagas',
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].ep, '/api/v1/triggers/templates/tmpl-career-jobs/activate');
    assert.equal(calls[0].opt.method, 'POST');
    assert.equal(trigger.id, 'trig-123');
    assert.equal(trigger.title, 'Meu Radar de Vagas');
  });

  test('getTemplates usa DEFAULT_TRIGGER_TEMPLATES em caso de falha de rede ou auth', async () => {
    const client = {
      request: async () => {
        throw new Error('cabeçalho de autorização ausente');
      },
    } as unknown as ApiClient;

    const api = new TriggersApi(client);
    const templates = await api.getTemplates();

    assert.ok(templates.length >= 8);
    assert.equal(templates[0].id, 'tmpl-career-jobs');
  });
});
