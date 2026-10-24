import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore
import {
  formatEventDuration,
  formatTodoDue,
  formatScheduledDate,
  formatBookingDays,
  formatBookingWindow,
  bookingDisplayLink,
  formatRecurrenceLabel,
  formatTriggerSchedule,
  formatMeetingMode,
  meetingDisplayLink,
  toChatMeeting,
  getContactInitials,
  formatRecipientPreview,
  formatMessageSnippet,
  toChatWhatsAppMessage,
  toChatGmailMessage,
} from './chatCards';

describe('Chat Cards helpers (TDD)', () => {
  describe('formatEventDuration', () => {
    it('formata minutos, horas cheias e horas quebradas', () => {
      assert.equal(formatEventDuration('2026-10-13T14:00:00', '2026-10-13T14:45:00'), '45 min');
      assert.equal(formatEventDuration('2026-10-13T14:00:00', '2026-10-13T15:00:00'), '1h');
      assert.equal(formatEventDuration('2026-10-13T14:00:00', '2026-10-13T15:30:00'), '1h30');
      assert.equal(formatEventDuration('2026-10-13T14:00:00', '2026-10-13T16:05:00'), '2h05');
    });

    it('retorna vazio para datas inválidas ou fim antes do início', () => {
      assert.equal(formatEventDuration('x', 'y'), '');
      assert.equal(formatEventDuration('2026-10-13T15:00:00', '2026-10-13T14:00:00'), '');
    });
  });

  describe('formatTodoDue', () => {
    it('formata prazo em pt-BR e trata ausência', () => {
      assert.equal(formatTodoDue(undefined), 'Sem prazo');
      assert.equal(formatTodoDue(''), 'Sem prazo');
      assert.equal(formatTodoDue('invalida'), 'Sem prazo');
      const out = formatTodoDue('2026-10-20T14:00:00-03:00');
      assert.ok(out.startsWith('Vence 20/10'), `got ${out}`);
    });
  });

  describe('formatScheduledDate', () => {
    it('extrai DD/MM de data simples e ISO', () => {
      assert.equal(formatScheduledDate(undefined), 'Sem data');
      assert.equal(formatScheduledDate('2026-10-20'), '20/10');
      assert.equal(formatScheduledDate('2026-10-20T00:00:00Z'), '20/10');
    });
  });

  describe('formatBookingDays', () => {
    it('rotula janelas semanais comuns', () => {
      assert.equal(formatBookingDays('[1,2,3,4,5,6,7]'), 'todos os dias');
      assert.equal(formatBookingDays(undefined), 'todos os dias');
      assert.equal(formatBookingDays('[1,2,3,4,5]'), 'dias úteis');
      assert.equal(formatBookingDays('[6,7]'), 'fim de semana');
    });
  });

  describe('formatBookingWindow', () => {
    it('compõe duração, horário e dias', () => {
      assert.equal(
        formatBookingWindow({ id: '1', title: 'Café', duration_minutes: 30, start_hour: '09:00', end_hour: '18:00', days_of_week: '[1,2,3,4,5,6,7]' }),
        '30 min · 09:00–18:00 · todos os dias'
      );
    });
  });

  describe('bookingDisplayLink', () => {
    it('prefere short_url e cai para public_url', () => {
      assert.equal(
        bookingDisplayLink({ id: '1', title: 'x', short_url: 'https://vito.s.gy/a', public_url: 'https://x/book' }),
        'https://vito.s.gy/a'
      );
      assert.equal(bookingDisplayLink({ id: '1', title: 'x', public_url: 'https://x/book' }), 'https://x/book');
      assert.equal(bookingDisplayLink({ id: '1', title: 'x' }), '');
    });
  });

  describe('formatRecurrenceLabel', () => {
    it('rotula recorrências em PT-BR', () => {
      assert.equal(formatRecurrenceLabel('WEEKLY'), 'Repete semanalmente');
      assert.equal(formatRecurrenceLabel('DAILY'), 'Repete diariamente');
      assert.equal(formatRecurrenceLabel('MONTHLY'), 'Repete mensalmente');
      assert.equal(formatRecurrenceLabel(undefined), null);
      assert.equal(formatRecurrenceLabel(''), null);
    });
  });

  describe('formatTriggerSchedule', () => {
    it('rotula frequência e horário do radar', () => {
      assert.equal(formatTriggerSchedule('daily_morning', '08:30'), 'Diário de manhã · 08:30');
      assert.equal(formatTriggerSchedule('hourly'), 'De hora em hora');
      assert.equal(formatTriggerSchedule(undefined, undefined), 'Diário de manhã');
    });
  });

  describe('formatMeetingMode', () => {
    it('rotula modos de reunião em PT-BR', () => {
      assert.equal(formatMeetingMode('group_consensus'), 'Enquete em Grupo (Consenso)');
      assert.equal(formatMeetingMode('one_on_one'), 'Reunião 1-on-1');
      assert.equal(formatMeetingMode('outro'), 'Reunião');
    });
  });

  describe('meetingDisplayLink', () => {
    it('prefere short_url e cai para public_url', () => {
      assert.equal(
        meetingDisplayLink({
          id: 'm1',
          title: 'Alinhamento',
          duration_minutes: 45,
          mode: 'group_consensus',
          status: 'open',
          short_url: 'https://vito.s.gy/meet1',
          public_url: 'https://vito.app/meet/m1',
        }),
        'https://vito.s.gy/meet1'
      );
      assert.equal(
        meetingDisplayLink({
          id: 'm1',
          title: 'Alinhamento',
          duration_minutes: 45,
          mode: 'group_consensus',
          status: 'open',
          public_url: 'https://vito.app/meet/m1',
        }),
        'https://vito.app/meet/m1'
      );
    });
  });

  describe('toChatMeeting', () => {
    it('extrai ChatMeeting de AssistantChatResponse', () => {
      const res = {
        intent: 'create_meeting',
        reply: 'Reunião criada',
        meeting: {
          id: 'm-123',
          title: 'Alinhamento Q4',
          description: 'Pauta geral',
          duration_minutes: 60,
          mode: 'group_consensus' as const,
          status: 'open',
          slots: [
            { id: 's1', meeting_id: 'm-123', start_at: '2026-10-20T19:00:00Z', end_at: '2026-10-20T20:00:00Z', votes_count: 0, created_at: '' }
          ],
        },
        meeting_short_url: 'https://vito.s.gy/m123',
        meeting_whatsapp_url: 'https://wa.me/?text=oi',
      };
      const cm = toChatMeeting(res as any);
      assert.ok(cm);
      assert.equal(cm?.id, 'm-123');
      assert.equal(cm?.title, 'Alinhamento Q4');
      assert.equal(cm?.short_url, 'https://vito.s.gy/m123');
      assert.equal(cm?.whatsapp_url, 'https://wa.me/?text=oi');
      assert.equal(cm?.slots_count, 1);
    });

    it('retorna undefined quando não há meeting na resposta', () => {
      const cm = toChatMeeting({ intent: 'general_chat', reply: 'Olá' } as any);
      assert.equal(cm, undefined);
    });
  });

  describe('getContactInitials', () => {
    it('extrai as iniciais de nomes simples e compostos', () => {
      assert.equal(getContactInitials('Mariana Silva'), 'MS');
      assert.equal(getContactInitials('Carlos'), 'C');
      assert.equal(getContactInitials('André Victor Magalhães'), 'AV');
      assert.equal(getContactInitials('joão da silva'), 'JS');
    });

    it('trata valores vazios ou nulos', () => {
      assert.equal(getContactInitials(''), '?');
      assert.equal(getContactInitials(undefined), '?');
      assert.equal(getContactInitials('   '), '?');
    });
  });

  describe('formatRecipientPreview', () => {
    it('formata destinatário com nome e destino', () => {
      assert.equal(
        formatRecipientPreview('Mariana Silva', '+55 11 99999-9999'),
        'Mariana Silva · +55 11 99999-9999'
      );
      assert.equal(
        formatRecipientPreview('Mariana Silva', 'mariana@empresa.com'),
        'Mariana Silva · mariana@empresa.com'
      );
    });

    it('lida com apenas nome ou apenas destino', () => {
      assert.equal(formatRecipientPreview('Mariana Silva', undefined), 'Mariana Silva');
      assert.equal(formatRecipientPreview(undefined, '+55 11 99999-9999'), '+55 11 99999-9999');
      assert.equal(formatRecipientPreview(undefined, undefined), 'Destinatário');
    });
  });

  describe('formatMessageSnippet', () => {
    it('trunca mensagens longas preservando palavras', () => {
      const longText = 'Olá Mariana, estou confirmando nossa reunião de alinhamento estratégico para a próxima quinta-feira às 14h.';
      const snippet = formatMessageSnippet(longText, 40);
      assert.ok(snippet.length <= 41, `esperado <= 41 mas recebeu ${snippet.length}`);
      assert.ok(snippet.endsWith('…'));
    });

    it('mantém mensagens curtas sem truncar', () => {
      assert.equal(formatMessageSnippet('Tudo certo!'), 'Tudo certo!');
    });
  });

  describe('toChatWhatsAppMessage & toChatGmailMessage', () => {
    it('extrai whatsapp_message de resposta estruturada', () => {
      const res = {
        intent: 'send_whatsapp',
        reply: 'Mensagem pronta',
        whatsapp_message: {
          recipient_name: 'Dra. Camila',
          recipient_phone: '+55 98 98888-7777',
          recipient_photo: 'https://cdn.example.com/camila.jpg',
          message: 'Olá Dra., confirmo a consulta de amanhã às 10h.',
        },
      };
      const wa = toChatWhatsAppMessage(res as any);
      assert.ok(wa);
      assert.equal(wa?.recipient_name, 'Dra. Camila');
      assert.equal(wa?.recipient_photo, 'https://cdn.example.com/camila.jpg');
      assert.equal(wa?.status, 'ready');
    });

    it('extrai gmail_message de resposta estruturada', () => {
      const res = {
        intent: 'send_email',
        reply: 'E-mail preparado',
        gmail_message: {
          recipient_name: 'Roberto Costa',
          recipient_email: 'roberto@acme.com',
          subject: 'Relatório Semanal de Desempenho',
          body: 'Prezado Roberto, segue em anexo a prévia do relatório semanal.',
        },
      };
      const gm = toChatGmailMessage(res as any);
      assert.ok(gm);
      assert.equal(gm?.recipient_email, 'roberto@acme.com');
      assert.equal(gm?.subject, 'Relatório Semanal de Desempenho');
      assert.equal(gm?.status, 'ready');
    });

    it('extrai whatsapp_message por fallback heurístico de texto plano', () => {
      const res = {
        intent: 'send_whatsapp',
        reply: 'Preparei a mensagem para Camila:\n\nOlá Camila, tudo bem?\n\nPosso enviar?',
      };
      const wa = toChatWhatsAppMessage(res as any);
      assert.ok(wa);
      assert.equal(wa?.recipient_name, 'Camila');
      assert.equal(wa?.message, 'Olá Camila, tudo bem?');
      assert.equal(wa?.status, 'ready');
    });

    it('extrai gmail_message por fallback heurístico de texto plano do screenshot do usuário', () => {
      const res = {
        intent: 'send_email',
        reply: 'E-mail enviado com sucesso para andrevictor8@gmail.com (Assunto: "Consulta sobre o repositório do aplicativo Vito").\n\nPrezado(a),\n\nEspero que este e-mail o(a) encontre bem.',
      };
      const gm = toChatGmailMessage(res as any);
      assert.ok(gm);
      assert.equal(gm?.recipient_email, 'andrevictor8@gmail.com');
      assert.equal(gm?.subject, 'Consulta sobre o repositório do aplicativo Vito');
      assert.ok(gm?.body.includes('Prezado(a)'));
      assert.equal(gm?.status, 'sent');
    });
  });
});
