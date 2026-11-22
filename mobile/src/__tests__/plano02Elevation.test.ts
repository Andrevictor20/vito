import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  scheduleCriticalAlarm,
  cancelCriticalAlarm,
  syncCriticalAlarmsFromEvents,
  consumePendingDismissedAlarm,
  buildMorningBriefingPromptFromAlarm,
} from '../services/criticalAlarmService';
import {
  parseSSEFrame,
  buildStreamFallbackResponse,
  normalizeStreamResponse,
  extractDeltaSteps,
} from '../services/api/chatStreamHelper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Plano 02 — Elevação Premium (SSE, Zero-Jank, Barge-In Kotlin & Alarme Crítico Nativo)', () => {
  it('Passo B: FormattedChatMessageText e ChatMessageBubble usam memoização (React.memo + useMemo)', () => {
    const formattedSrc = fs.readFileSync(
      path.resolve(__dirname, '../components/chat/FormattedChatMessageText.tsx'),
      'utf8'
    );
    const bubbleSrc = fs.readFileSync(
      path.resolve(__dirname, '../components/chat/ChatMessageBubble.tsx'),
      'utf8'
    );
    assert.ok(formattedSrc.includes('useMemo'));
    assert.ok(formattedSrc.includes('React.memo'));
    assert.ok(bubbleSrc.includes('React.memo'));
  });

  it('Passo B: inputText isolado em ChatInputDock (ChatScreen não mantém estado de digitação por tecla)', () => {
    const chatScreenSrc = fs.readFileSync(
      path.resolve(__dirname, '../screens/ChatScreen.tsx'),
      'utf8'
    );
    const dockSrc = fs.readFileSync(
      path.resolve(__dirname, '../components/chat/ChatInputDock.tsx'),
      'utf8'
    );
    assert.equal(chatScreenSrc.includes('const [inputText, setInputText]'), false);
    assert.ok(dockSrc.includes('const [inputText, setInputText]'));
    assert.ok(dockSrc.includes('useImperativeHandle'));
  });

  it('Passo B: ThinkingProcessAccordion integrado com touch target >= 44dp e edit buttons >= 44dp', () => {
    const accordionPath = path.resolve(__dirname, '../components/chat/ThinkingProcessAccordion.tsx');
    assert.equal(fs.existsSync(accordionPath), true);
    const accordionSrc = fs.readFileSync(accordionPath, 'utf8');
    const chatScreenSrc = fs.readFileSync(path.resolve(__dirname, '../screens/ChatScreen.tsx'), 'utf8');
    const bubbleSrc = fs.readFileSync(path.resolve(__dirname, '../components/chat/ChatMessageBubble.tsx'), 'utf8');

    assert.ok(accordionSrc.includes('minHeight: 44'));
    assert.ok(accordionSrc.includes('hitSlop'));
    assert.ok(chatScreenSrc.includes('ThinkingProcessAccordion'));
    assert.ok(bubbleSrc.includes('ThinkingProcessAccordion'));
    assert.ok(bubbleSrc.includes('minHeight: 44'));
  });

  it('Passo B: ChatApi + chatStreamHelper consomem /api/v1/assistant/chat/stream com intent obrigatório e deltas de raciocínio', () => {
    const chatApiSrc = fs.readFileSync(
      path.resolve(__dirname, '../services/api/chatApi.ts'),
      'utf8'
    );
    const runnerSrc = fs.readFileSync(
      path.resolve(__dirname, '../hooks/chatStreamRunner.ts'),
      'utf8'
    );
    const useMessagesSrc = fs.readFileSync(
      path.resolve(__dirname, '../hooks/useChatMessages.ts'),
      'utf8'
    );
    assert.ok(chatApiSrc.includes('assistantChatStream'));
    assert.ok(chatApiSrc.includes('/api/v1/assistant/chat/stream'));
    assert.ok(runnerSrc.includes('assistantChatStream'));
    // Tanto sendMessage quanto editAndResendMessage delegam ao runner de streaming
    const runnerCalls = useMessagesSrc.match(/runAssistantStreamTurn\(/g) || [];
    assert.equal(runnerCalls.length, 2);

    const fallback = buildStreamFallbackResponse('Olá mundo');
    assert.equal(fallback.intent, 'general_chat');
    assert.equal(fallback.reply, 'Olá mundo');

    const normalized = normalizeStreamResponse({ text: 'Pronto', reasoning: ['Etapa 1'] });
    assert.equal(normalized.intent, 'general_chat');
    assert.equal(normalized.reply, 'Pronto');

    const parsed = parseSSEFrame('data: {"text_delta":"Oi","reasoning_delta":"Consultando agenda"}');
    assert.equal(parsed.event, 'message');
    assert.equal(parsed.data.text_delta, 'Oi');

    const steps = extractDeltaSteps({
      tool_name: 'calendar_list',
      reasoning_delta: 'Verificando horários',
      tool_calls: [{ name: 'todo_create' }],
    });
    assert.deepEqual(steps, ['calendar_list', 'todo_create', 'Verificando horários']);
  });

  it('Passo C: VitoDuplexAudioModule.kt permite Barge-in Real sem overload conflitante', () => {
    const ktSrc = fs.readFileSync(
      path.resolve(__dirname, '../../android/app/src/main/java/com/andrevmp/vito/voice/VitoDuplexAudioModule.kt'),
      'utf8'
    );
    const playTtsBlock = ktSrc.split('fun playTtsAudio')[1]?.split('fun startFullDuplexAudio')[0] || '';
    assert.equal(playTtsBlock.includes('stopRecordingInternal()'), false);
    assert.ok(ktSrc.includes('stopBotPlaybackImmediately'));
    assert.ok(ktSrc.includes('stopBotPlaybackInternal'));
  });

  it('Passo D: Subsistema Kotlin de Alarme Crítico e AndroidManifest estão configurados e ligados ao JS', () => {
    const receiverPath = path.resolve(
      __dirname,
      '../../android/app/src/main/java/com/andrevmp/vito/alarm/VitoAlarmReceiver.kt'
    );
    const activityPath = path.resolve(
      __dirname,
      '../../android/app/src/main/java/com/andrevmp/vito/alarm/VitoAlarmActivity.kt'
    );
    const modulePath = path.resolve(
      __dirname,
      '../../android/app/src/main/java/com/andrevmp/vito/alarm/VitoAlarmModule.kt'
    );
    const manifestPath = path.resolve(__dirname, '../../android/app/src/main/AndroidManifest.xml');

    assert.equal(fs.existsSync(receiverPath), true);
    assert.equal(fs.existsSync(activityPath), true);
    assert.equal(fs.existsSync(modulePath), true);

    const manifestSrc = fs.readFileSync(manifestPath, 'utf8');
    assert.ok(manifestSrc.includes('VitoAlarmActivity'));
    assert.ok(manifestSrc.includes('VitoAlarmReceiver'));
    assert.ok(manifestSrc.includes('USE_FULL_SCREEN_INTENT'));

    const appRootSrc = fs.readFileSync(path.resolve(__dirname, '../AppRoot.tsx'), 'utf8');
    const homeDataSrc = fs.readFileSync(path.resolve(__dirname, '../hooks/useHomeData.ts'), 'utf8');
    assert.ok(appRootSrc.includes('subscribeCriticalAlarmDismissed'));
    assert.ok(homeDataSrc.includes('syncEventsAndTodosReminders'));
    assert.ok(homeDataSrc.includes('scheduleEventRemindersAndAlarm'));
    assert.ok(homeDataSrc.includes('cancelEventRemindersAndAlarms'));
  });

  it('Passo D: criticalAlarmService agenda, sincroniza, cancela e consome alarme dispensado', async () => {
    const scheduled: Array<{ id: string; triggerEpochMs: number; title: string }> = [];
    const cancelled: string[] = [];
    const fakeNative = {
      scheduleCriticalAlarm: async (id: string, triggerEpochMs: number, title: string) => {
        scheduled.push({ id, triggerEpochMs, title });
        return true;
      },
      cancelCriticalAlarm: async (id: string) => {
        cancelled.push(id);
        return true;
      },
      consumePendingDismissedAlarm: async () => ({
        alarmId: 'ev-2',
        eventTitle: 'Reunião Diretoria',
        dismissedAt: 1700000000000,
      }),
    };

    const futureTime = Date.now() + 3600_000;
    const ok = await scheduleCriticalAlarm('ev-1', futureTime, 'Voo para São Paulo', fakeNative);
    assert.equal(ok, true);
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0].id, 'ev-1');

    const count = await syncCriticalAlarmsFromEvents(
      [
        {
          id: 'ev-2',
          title: '[ALARME] Reunião Diretoria',
          start_at: new Date(Date.now() + 7200_000).toISOString(),
          critical_alarm: true,
          wake_offset_minutes: 30,
        },
        {
          id: 'ev-normal',
          title: 'Almoço',
          start_at: new Date(Date.now() + 7200_000).toISOString(),
        },
      ],
      fakeNative
    );
    assert.equal(count, 1);
    assert.equal(scheduled.length, 2);
    assert.equal(scheduled[1].title, 'Reunião Diretoria');

    const cancelOk = await cancelCriticalAlarm('ev-1', fakeNative);
    assert.equal(cancelOk, true);
    assert.ok(cancelled.includes('ev-1'));

    const dismissed = await consumePendingDismissedAlarm(fakeNative);
    assert.equal(dismissed?.alarmId, 'ev-2');
    const prompt = buildMorningBriefingPromptFromAlarm(dismissed!);
    assert.ok(prompt.includes('Reunião Diretoria'));
    assert.ok(prompt.includes('briefing matinal'));
  });
});
