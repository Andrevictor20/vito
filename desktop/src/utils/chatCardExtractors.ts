import { ChatGmailMessage, ChatWhatsAppMessage } from '../types';

export interface AssistantChatResponse {
  reply?: string;
  message?: string;
  whatsapp_message?: ChatWhatsAppMessage;
  gmail_message?: ChatGmailMessage;
  [key: string]: any;
}

/**
 * Extrator e sintetizador resiliente de mensagens Gmail para cards in-chat.
 * Alinhado 1:1 ao mobile (mobile/src/utils/chatCards.ts).
 */
export const toChatGmailMessage = (
  res: AssistantChatResponse,
  userPrompt?: string
): ChatGmailMessage | undefined => {
  // 1. Resposta já estruturada do backend Go
  if (res.gmail_message) {
    const gm = res.gmail_message;
    return {
      ...gm,
      status: gm.status || 'ready',
    };
  }

  const replyText = (res.reply || res.message || '').trim();

  // 2. Fallback heurístico resiliente de textos de rascunho / envio
  const match = replyText.match(
    /(?:E-mail enviado com sucesso para|Preparei o rascunho do e-mail para|Criei o rascunho no seu Gmail para|Ajustei o e-mail para)\s+([^\s(]+)(?:\s*\(Assunto:\s*"([^"]+)"\))?[:\n\s]*([\s\S]*)/i
  );
  if (match) {
    const email = match[1].trim();
    const subject = match[2] ? match[2].trim() : 'Sem assunto';
    let body = (match[3] || '').trim();
    body = body.replace(/[\n\s]*Posso enviar\?[\s\S]*$/i, '').trim();
    const isSent = replyText.toLowerCase().includes('e-mail enviado com sucesso');
    return {
      recipient_email: email,
      subject,
      body: body || replyText,
      status: isSent ? 'sent' : 'ready',
      sent_at: isSent ? new Date().toISOString() : undefined,
    };
  }

  // 3. Fallback de confirmação quando o bot pede autorização do destinatário
  // Ex: "O endereço **andrevictor8@gmail.com** não está associado aos seus contatos... Confirma se esse é o endereço correto para enviar o e-mail?"
  const confirmMatch = replyText.match(
    /(?:O endereço|o e-mail|o destinatário)\s+\*\*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\*\*?[\s\S]*(?:Confirma|deseja enviar|posso enviar)/i
  );
  if (confirmMatch) {
    const extractedEmail = confirmMatch[1].trim();

    // Extrai mensagem ou assunto da instrução do usuário (ex: "Envie um email para andrevictor8@gmail.com: Testando o vito!")
    let subject = 'Mensagem enviada via Vito';
    let body = 'Mensagem de teste do assistente Vito.';

    if (userPrompt) {
      const promptMatch = userPrompt.match(/(?:email|e-mail)\s+(?:para\s+)?(?:\S+@\S+)?[:\s-]+\s*([\s\S]+)/i);
      if (promptMatch && promptMatch[1]) {
        body = promptMatch[1].trim();
        subject = body.length > 50 ? `${body.slice(0, 47)}…` : body;
      }
    }

    return {
      recipient_email: extractedEmail,
      recipient_name: extractedEmail.split('@')[0],
      subject,
      body,
      status: 'ready',
    };
  }

  // 4. Fallback direto da intenção de envio do prompt do usuário
  if (userPrompt) {
    const userEmailMatch = userPrompt.match(
      /(?:Envie|Mande|Enviar|Mandar)\s+(?:um\s+)?(?:email|e-mail)\s+para\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})[:\s-]+\s*([\s\S]+)/i
    );
    if (userEmailMatch) {
      const email = userEmailMatch[1].trim();
      const body = userEmailMatch[2].trim();
      return {
        recipient_email: email,
        recipient_name: email.split('@')[0],
        subject: body.length > 50 ? `${body.slice(0, 47)}…` : body,
        body,
        status: 'ready',
      };
    }
  }

  return undefined;
};

/**
 * Extrator e sintetizador resiliente de mensagens WhatsApp para cards in-chat.
 * Alinhado 1:1 ao mobile (mobile/src/utils/chatCards.ts).
 */
export const toChatWhatsAppMessage = (
  res: AssistantChatResponse,
  userPrompt?: string
): ChatWhatsAppMessage | undefined => {
  // 1. Resposta já estruturada do backend
  if (res.whatsapp_message) {
    const wm = res.whatsapp_message;
    return {
      ...wm,
      status: wm.status || 'ready',
    };
  }

  const replyText = (res.reply || res.message || '').trim();

  // 2. Fallback de texto do backend
  const match = replyText.match(
    /(?:Enviei para|Preparei a mensagem para|Preparei o rascunho para|Rascunho para)\s+([^:\n]+)[:\n]+([\s\S]+)/i
  );
  if (match) {
    const rawRecipient = match[1].trim();
    let body = match[2].trim();
    body = body.replace(/[\n\s]*Posso enviar\?[\s\S]*$/i, '').trim();
    const isSent = replyText.toLowerCase().includes('enviei para');
    return {
      recipient_name: rawRecipient,
      message: body,
      status: isSent ? 'sent' : 'ready',
      sent_at: isSent ? new Date().toISOString() : undefined,
    };
  }

  // 3. Fallback de intenção do prompt do usuário
  if (userPrompt) {
    const userWaMatch = userPrompt.match(
      /(?:Envie|Mande|Enviar|Mandar)\s+(?:uma\s+mensagem\s+(?:no|de|via|pelo)\s+)?whatsapp\s+para\s+([^:\n]+)[:\n]+\s*([\s\S]+)/i
    );
    if (userWaMatch) {
      const recipient = userWaMatch[1].trim();
      const body = userWaMatch[2].trim();
      return {
        recipient_name: recipient,
        message: body,
        status: 'ready',
      };
    }
  }

  return undefined;
};
