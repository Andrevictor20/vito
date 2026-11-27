import type { AssistantChatResponse, ChatMessage } from '../../../types';
import { api } from '../../../services/api';
import type { ChatStreamDelta } from '../services/chatStreamHelper';
import { extractDeltaSteps } from '../services/chatStreamHelper';
import { buildAssistantMessage } from './chatMessageEffects';
import { formatHistoryForStream, formatToolCallStepLabel } from '../utils/chatMessageBuilder';

export { formatHistoryForStream, formatToolCallStepLabel };

export interface RunAssistantStreamTurnParams {
  prompt: string;
  baseMessages: ChatMessage[];
  historySource: ChatMessage[];
  threadId: string;
  focusMode?: string;
  resetHistory?: boolean;
  signal: AbortSignal;
  setMessages: (next: ChatMessage[]) => void;
  setStreamingSteps: (steps: string[]) => void;
}

export async function runAssistantStreamTurn({
  prompt,
  baseMessages,
  historySource,
  threadId,
  focusMode,
  resetHistory,
  signal,
  setMessages,
  setStreamingSteps,
}: RunAssistantStreamTurnParams): Promise<{ res: AssistantChatResponse; vitoMsg: ChatMessage }> {
  const recentHistory = formatHistoryForStream(historySource);

  const streamMsgId = `vito-stream-${Date.now()}`;
  let streamedText = '';
  const collectedSteps: string[] = [];
  const seenSteps = new Set<string>();

  const pushSteps = (candidates: string[]) => {
    let added = false;
    for (const step of candidates) {
      if (step && !seenSteps.has(step)) {
        seenSteps.add(step);
        collectedSteps.push(step);
        added = true;
      }
    }
    if (added) {
      setStreamingSteps([...collectedSteps]);
    }
  };

  const chatOpts = {
    thread_id: threadId,
    channel: 'app_mobile',
    history: recentHistory,
    reset_history: resetHistory,
    signal,
    focus_mode: focusMode,
  };

  const isMockedChat = Boolean(Reflect.get(api.assistantChat, '_isMockFunction'));
  const res =
    typeof api.assistantChatStream === 'function' && !isMockedChat
      ? await api.assistantChatStream(prompt, chatOpts, (delta: ChatStreamDelta) => {
          // Ignora tokens crus de reasoning do modelo para não poluir a lista de etapas
          if (delta.type !== 'reasoning' && !delta.reasoning_delta) {
            const mapped = extractDeltaSteps(delta)
              .map((raw) => formatToolCallStepLabel({ tool: raw, operation: raw }))
              .filter(Boolean);
            pushSteps(mapped);
          }
          const isMetaEvent = delta.type === 'reasoning' || delta.type === 'status' || delta.type === 'tool_call';
          const textChunk = delta.text_delta || (!isMetaEvent ? delta.content : '') || '';
          if (textChunk) {
            streamedText += textChunk;
            setMessages([
              ...baseMessages,
              {
                id: streamMsgId,
                sender: 'vito',
                text: streamedText,
                thinkingSteps: collectedSteps.length > 0 ? [...collectedSteps] : undefined,
                timestamp: new Date().toISOString(),
              },
            ]);
          }
        })
      : await api.assistantChat(prompt, chatOpts);

  if (Array.isArray(res.tool_calls)) {
    pushSteps(res.tool_calls.map(formatToolCallStepLabel).filter(Boolean));
  }

  const vitoMsg = buildAssistantMessage('vito', res, 'Instrução processada com sucesso.');
  if (collectedSteps.length > 0) {
    vitoMsg.thinkingSteps = [...collectedSteps];
  }

  return { res, vitoMsg };
}
