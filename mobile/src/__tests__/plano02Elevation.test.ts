import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

  it('AC-07: Subsistema de Alarme Crítico removido do AndroidManifest, Kotlin e JS', () => {
    const alarmDir = path.resolve(
      __dirname,
      '../../android/app/src/main/java/com/andrevmp/vito/alarm'
    );
    const manifestPath = path.resolve(__dirname, '../../android/app/src/main/AndroidManifest.xml');

    assert.equal(fs.existsSync(alarmDir), false);

    const manifestSrc = fs.readFileSync(manifestPath, 'utf8');
    assert.equal(manifestSrc.includes('VitoAlarmActivity'), false);
    assert.equal(manifestSrc.includes('VitoAlarmReceiver'), false);
    assert.equal(manifestSrc.includes('USE_FULL_SCREEN_INTENT'), false);

    const appRootSrc = fs.readFileSync(path.resolve(__dirname, '../AppRoot.tsx'), 'utf8');
    const homeDataSrc = fs.readFileSync(path.resolve(__dirname, '../hooks/useHomeData.ts'), 'utf8');
    assert.equal(appRootSrc.includes('subscribeCriticalAlarmDismissed'), false);
    assert.equal(homeDataSrc.includes('syncEventsAndTodosReminders'), false);
    assert.equal(homeDataSrc.includes('scheduleEventRemindersAndAlarm'), false);
    assert.equal(homeDataSrc.includes('cancelEventRemindersAndAlarms'), false);
  });
});
