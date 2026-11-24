import { AssistantChatResponse } from '../../../types';

export interface ChatStreamDelta {
  type?: string;
  content?: string;
  text_delta?: string;
  reasoning_delta?: string;
  tool_name?: string;
  tool_calls?: Array<{ id?: string; name?: string }>;
}

export interface ParsedSSEFrame {
  event: string;
  data: any;
  raw: string;
}

export function parseSSEFrame(frame: string): ParsedSSEFrame {
  let event = 'message';
  let rawData = '';
  for (const line of frame.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('event:')) {
      event = trimmed.slice(6).trim();
    } else if (trimmed.startsWith('data:')) {
      rawData += trimmed.slice(5).trim();
    }
  }
  if (!rawData) {
    return { event, data: null, raw: '' };
  }
  try {
    return { event, data: JSON.parse(rawData), raw: rawData };
  } catch {
    return { event, data: null, raw: rawData };
  }
}

export function buildStreamFallbackResponse(accumulatedText: string): AssistantChatResponse {
  return {
    intent: 'general_chat',
    reply: accumulatedText,
    message: accumulatedText,
  };
}

export function normalizeStreamResponse(data: any): AssistantChatResponse {
  const replyText = data?.reply || data?.text || data?.message || '';
  return {
    ...data,
    intent: data?.intent || 'general_chat',
    reply: replyText,
    message: data?.message || replyText,
  };
}

export function extractDeltaSteps(delta: ChatStreamDelta): string[] {
  const steps: string[] = [];
  if (delta.tool_name && delta.tool_name.trim()) {
    steps.push(delta.tool_name.trim());
  }
  if (Array.isArray(delta.tool_calls)) {
    for (const tc of delta.tool_calls) {
      if (tc?.name && tc.name.trim()) {
        steps.push(tc.name.trim());
      }
    }
  }
  if (delta.reasoning_delta && delta.reasoning_delta.trim()) {
    steps.push(delta.reasoning_delta.trim());
  }
  if (
    (delta.type === 'reasoning' || delta.type === 'status' || delta.type === 'tool') &&
    delta.content?.trim()
  ) {
    steps.push(delta.content.trim());
  }
  return steps;
}

function handleParsedFrame(
  parsed: ParsedSSEFrame,
  onDelta: ((delta: ChatStreamDelta) => void) | undefined,
  state: { finalResponse: AssistantChatResponse | null; accumulatedText: string }
): void {
  if (parsed.event === 'done' && parsed.data) {
    state.finalResponse = normalizeStreamResponse(parsed.data);
    return;
  }
  if (parsed.event === 'error') {
    throw new Error(String(parsed.raw || 'Falha no streaming SSE'));
  }
  if (!parsed.data) return;

  const chunk = parsed.data.text_delta || parsed.data.content || '';
  if (chunk && parsed.data.type !== 'reasoning' && parsed.data.type !== 'status') {
    state.accumulatedText += chunk;
  }
  onDelta?.({
    ...parsed.data,
    content: chunk,
  });
}

export async function consumeSSEStream(
  res: Response,
  onDelta?: (delta: ChatStreamDelta) => void
): Promise<AssistantChatResponse | null> {
  const state = {
    finalResponse: null as AssistantChatResponse | null,
    accumulatedText: '',
  };
  const streamBody = res.body as ReadableStream<Uint8Array> | null | undefined;
  const reader =
    streamBody && typeof streamBody.getReader === 'function' ? streamBody.getReader() : undefined;

  if (reader && typeof TextDecoder !== 'undefined') {
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';
      for (const frame of frames) {
        handleParsedFrame(parseSSEFrame(frame), onDelta, state);
      }
    }
    if (buffer.trim()) {
      handleParsedFrame(parseSSEFrame(buffer), onDelta, state);
    }
  } else {
    const rawStreamText = await res.text();
    for (const frame of rawStreamText.split('\n\n')) {
      handleParsedFrame(parseSSEFrame(frame), onDelta, state);
    }
  }

  if (state.finalResponse) {
    return state.finalResponse;
  }
  if (state.accumulatedText) {
    return buildStreamFallbackResponse(state.accumulatedText);
  }
  return null;
}

export function buildAssistantConfirmPayload(
  pendingId: string,
  options?: { reject?: boolean; reason?: string; threadId?: string }
): Record<string, unknown> {
  return {
    pending_id: pendingId,
    ...(options?.reject !== undefined ? { reject: options.reject } : {}),
    ...(options?.reason ? { reason: options.reason } : {}),
    ...(options?.threadId ? { thread_id: options.threadId } : {}),
  };
}

export async function executeChatStreamFetch(params: {
  url: string;
  headers: Record<string, string>;
  bodyPayload: string;
  externalSignal?: AbortSignal;
  timeoutMs?: number;
  onDelta?: (delta: ChatStreamDelta) => void;
  fallbackChat: () => Promise<AssistantChatResponse>;
}): Promise<AssistantChatResponse> {
  const streamTimeoutMs = params.timeoutMs ?? 90000;
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, streamTimeoutMs);

  const onExternalAbort = () => {
    clearTimeout(timeoutId);
    controller.abort();
  };
  if (params.externalSignal) {
    if (params.externalSignal.aborted) {
      clearTimeout(timeoutId);
      controller.abort();
    } else {
      params.externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  let streamConnected = false;
  try {
    const res = await fetch(params.url, {
      method: 'POST',
      headers: params.headers,
      body: params.bodyPayload,
      signal: controller.signal,
    });

    if (!res.ok) {
      if (res.status === 404 || res.status === 405 || res.status === 501) {
        return params.fallbackChat();
      }
      throw new Error(`Falha HTTP ${res.status} no streaming do chat`);
    }

    streamConnected = true;
    const streamResult = await consumeSSEStream(res, params.onDelta);
    if (streamResult) {
      return streamResult;
    }
    throw new Error('Stream SSE encerrado sem resposta final do assistente.');
  } catch (err: any) {
    if (params.externalSignal?.aborted) {
      throw err;
    }
    if (timedOut) {
      throw new Error(
        `Tempo limite esgotado (${Math.round(streamTimeoutMs / 1000)}s) no streaming do chat.`
      );
    }
    if (streamConnected) {
      throw err;
    }
    return params.fallbackChat();
  } finally {
    clearTimeout(timeoutId);
    params.externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}
