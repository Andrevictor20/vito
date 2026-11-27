import { ApiClient, PI_SERVER_URL, CLOUDFLARE_SERVER_URL, DEFAULT_SERVER_URL, isCloudServer } from './client';
import { fileUriToBase64 } from './fileUtils';
import { ApiRequestOptions, ChatHistoryItem, AssistantChatOptions } from './types';
import { AuthApi } from './authApi';
import { CalendarApi } from '../../features/calendar/services/calendarApi';
import { PendingApi, TodosApi } from '../../features/tasks/services/tasksApi';
import { ChatApi, ChatStreamDelta } from '../../features/chat/services/chatApi';
import { BookingApi, MeetingsApi } from '../../features/calendar/services/bookingApi';
import { PhoneVerificationApi } from '../../features/profile/services/phoneVerificationService';
import { NotificationsApi } from '../../features/notifications/services/notificationsApi';
import { AiSettingsApi } from '../../features/profile/services/aiSettingsApi';
import { WhatsAppApi, WhatsAppIntegrationStatus } from '../../features/profile/services/whatsappApi';
import { GmailApi, GmailStatusResponse, GmailScanResult, ScannedBill, ScannedFlight, UrgentEmail } from '../../features/profile/services/gmailApi';
import { WhatsAppAuthApi, RequestWhatsAppOTPResponse, VerifyWhatsAppOTPResponse } from '../../features/profile/services/whatsappAuthApi';
import { FinanceApi } from '../../features/finance/services/financeApi';
import { AiProvidersApi } from '../../features/profile/services/aiProvidersApi';
import { BotsApi } from '../../features/bots/services/botsApi';
import { StoreComplianceApi } from '../../features/store/services/storeComplianceApi';
import type {
  ActionPolicy,
  Bot,
  BotAppInfo,
  BotChatMessage,
  BotRunReport,
  BotTemplate,
  CreateBotPayload,
  PendingResolutionDecision,
  SkillPackage,
  UpdateBotPayload,
} from '../../features/bots/types/bots';
import {
  User, AuthResponse, Event, Todo, Subtask, AssistantChatResponse, ConflictInfo, Trigger, TriggerCategory,
  TriggerLog, TriggerTestResult, TriggerStatus, CreateTriggerInput, TriggerTemplate,
  AutonomyMode, AISettings, PendingItem, PendingStatus, CreatePendingInput, UpdatePendingInput, BookingType,
  BookingAppointment, DeleteBookingImpact, Meeting, MeetingWithDetails,
  ChatMessage, ConversationSession, UserSession,
} from '../../types';

export {
  PI_SERVER_URL, CLOUDFLARE_SERVER_URL, DEFAULT_SERVER_URL, isCloudServer, fileUriToBase64,
  ApiRequestOptions, ChatHistoryItem, AssistantChatOptions, WhatsAppIntegrationStatus,
  GmailStatusResponse, GmailScanResult,
  ScannedBill, ScannedFlight, UrgentEmail, RequestWhatsAppOTPResponse, VerifyWhatsAppOTPResponse,
};

export class ApiService extends ApiClient {
  private authApi = new AuthApi(this);
  private calendarApi = new CalendarApi(this);
  private todosApi = new TodosApi(this);
  private chatApi = new ChatApi(this);
  private pendingApi = new PendingApi(this);
  private bookingApi = new BookingApi(this);
  private meetingsApi = new MeetingsApi(this);
  private phoneVerificationApi = new PhoneVerificationApi(this);
  private notificationsApi = new NotificationsApi(this);
  private aiSettingsApi = new AiSettingsApi(this);
  private whatsappApi = new WhatsAppApi(this);
  private gmailApi = new GmailApi(this);
  private whatsappAuthApi = new WhatsAppAuthApi(this);
  private financeApi = new FinanceApi(this);
  private aiProvidersApi = new AiProvidersApi(this);
  private botsApi = new BotsApi(this);
  private storeComplianceApi = new StoreComplianceApi(this);

  // Bots
  listBots(): Promise<Bot[]> { return this.botsApi.listBots(); }
  getBot(id: string): Promise<Bot> { return this.botsApi.getBot(id); }
  createBot(payload: CreateBotPayload): Promise<Bot> { return this.botsApi.createBot(payload); }
  updateBot(id: string, payload: UpdateBotPayload): Promise<Bot> { return this.botsApi.updateBot(id, payload); }
  deleteBot(id: string): Promise<void> { return this.botsApi.deleteBot(id); }
  runBot(id: string): Promise<BotRunReport> { return this.botsApi.runBot(id); }
  getBotChat(id: string): Promise<BotChatMessage[]> { return this.botsApi.getBotChat(id); }
  sendBotChat(id: string, message: string): Promise<{ reply?: BotChatMessage; messages?: BotChatMessage[] }> { return this.botsApi.sendBotChat(id, message); }
  addBotAction(id: string, payload: { action_key: string; policy: ActionPolicy; always_ask?: boolean }): Promise<Bot> { return this.botsApi.addBotAction(id, payload); }
  updateBotAction(id: string, actionKey: string, policy: ActionPolicy, alwaysAsk?: boolean): Promise<Bot> { return this.botsApi.updateBotAction(id, actionKey, policy, alwaysAsk); }
  removeBotAction(id: string, actionKey: string): Promise<Bot> { return this.botsApi.removeBotAction(id, actionKey); }
  addBotSkill(id: string, skillKey: string): Promise<Bot> { return this.botsApi.addBotSkill(id, skillKey); }
  removeBotSkill(id: string, skillKey: string): Promise<Bot> { return this.botsApi.removeBotSkill(id, skillKey); }
  upgradeBotSkill(id: string, skillKey: string): Promise<Bot> { return this.botsApi.upgradeBotSkill(id, skillKey); }
  resolveBotPending(id: string, confirmationId: string, decision: PendingResolutionDecision, alwaysAsk?: boolean): Promise<void> { return this.botsApi.resolvePending(id, confirmationId, decision, alwaysAsk); }
  getBotCatalogTemplates(): Promise<BotTemplate[]> { return this.botsApi.getCatalogTemplates(); }
  getBotCatalogSkills(): Promise<SkillPackage[]> { return this.botsApi.getCatalogSkills(); }
  getBotApps(): Promise<BotAppInfo[]> { return this.botsApi.getApps(); }
  suggestBotApp(name: string, reason: string): Promise<void> { return this.botsApi.suggestApp(name, reason); }

  // Auth & Sessions
  login(email: string, password: string): Promise<AuthResponse> { return this.authApi.login(email, password); }
  register(name: string, email: string, password: string): Promise<AuthResponse> { return this.authApi.register(name, email, password); }
  getMe(): Promise<{ user: User }> { return this.authApi.getMe(); }
  getSessions(): Promise<{ sessions: UserSession[] }> { return this.authApi.getSessions(); }
  revokeSession(sessionId: string): Promise<{ status: string }> { return this.authApi.revokeSession(sessionId); }
  revokeOtherSessions(): Promise<{ status: string }> { return this.authApi.revokeOtherSessions(); }
  logoutSession(): Promise<{ status: string }> { return this.authApi.logoutSession(); }

  // Calendar
  getEvents(): Promise<Event[]> { return this.calendarApi.getEvents(); }
  createEvent(event: {
    title: string;
    description?: string;
    location?: string;
    start_at: string;
    end_at: string;
    recurrence?: string;
    critical_alarm?: boolean;
    wake_offset_minutes?: number;
  }) {
    return this.calendarApi.createEvent(event);
  }
  updateEvent(id: string, eventData: Partial<Event> & { update_series?: boolean }): Promise<{ event: Event; updated_count: number }> {
    return this.calendarApi.updateEvent(id, eventData);
  }
  deleteEvent(id: string, allSeries: boolean = false): Promise<void> { return this.calendarApi.deleteEvent(id, allSeries); }
  syncCalendar(provider: string = 'google'): Promise<{ status: string; provider: string }> { return this.calendarApi.syncCalendar(provider); }

  // Todos
  getTodos(status?: string): Promise<Todo[]> {
    return this.todosApi.getTodos(status);
  }
  createTodo(todo: {
    title: string;
    priority?: string;
    category?: string;
    due_date?: string;
    remind_at?: string;
    remind_repeat?: string;
    remind_advance_minutes?: number;
    event_id?: string;
    event_title?: string;
  }): Promise<Todo> {
    return this.todosApi.createTodo(todo);
  }
  completeTodo(id: string): Promise<{ status: string }> {
    return this.todosApi.completeTodo(id);
  }
  reopenTodo(id: string): Promise<{ status: string }> {
    return this.todosApi.reopenTodo(id);
  }
  deleteTodo(id: string): Promise<void> {
    return this.todosApi.deleteTodo(id);
  }
  updateTodo(
    id: string,
    data: {
      title?: string;
      priority?: string;
      category?: string;
      due_date?: string;
      remind_at?: string;
      remind_repeat?: string;
      remind_advance_minutes?: number;
    }
  ): Promise<Todo> {
    return this.todosApi.updateTodo(id, data);
  }
  addSubtask(todoId: string, title: string): Promise<Subtask> {
    return this.todosApi.addSubtask(todoId, title);
  }
  suggestSubtasks(todoId: string): Promise<Subtask[]> {
    return this.todosApi.suggestSubtasks(todoId);
  }
  toggleSubtask(todoId: string, subtaskId: string): Promise<Subtask> {
    return this.todosApi.toggleSubtask(todoId, subtaskId);
  }
  deleteSubtask(todoId: string, subtaskId: string): Promise<void> {
    return this.todosApi.deleteSubtask(todoId, subtaskId);
  }

  // Chat & Vision
  assistantChat(prompt: string, options?: string | AssistantChatOptions): Promise<AssistantChatResponse> {
    return this.chatApi.assistantChat(prompt, options);
  }
  assistantChatStream(
    prompt: string,
    options?: string | AssistantChatOptions,
    onDelta?: (delta: ChatStreamDelta) => void
  ): Promise<AssistantChatResponse> {
    return this.chatApi.assistantChatStream(prompt, options, onDelta);
  }
  assistantConfirm = (pendingId: string, options?: { reject?: boolean; reason?: string; threadId?: string }): Promise<AssistantChatResponse> =>
    this.chatApi.assistantConfirm(pendingId, options);
  assistantAudio(audioUri: string, filename: string = 'audio.m4a', options?: string | AssistantChatOptions): Promise<AssistantChatResponse> {
    return this.chatApi.assistantAudio(audioUri, filename, options);
  }
  assistantVision(
    imageUri: string,
    prompt?: string,
    filename: string = 'image.jpg',
    timezone?: string,
    base64Override?: string,
    mimeType?: string,
    threadId?: string
  ): Promise<AssistantChatResponse> {
    return this.chatApi.assistantVision(imageUri, prompt, filename, timezone, base64Override, mimeType, threadId);
  }
  getChatSessions(): Promise<ConversationSession[]> {
    return this.chatApi.getChatSessions();
  }
  getChatSessionWithMessages(id: string): Promise<{ session: ConversationSession; messages: ChatMessage[] } | null> {
    return this.chatApi.getChatSessionWithMessages(id);
  }
  syncChatSession(session: ConversationSession, messages: ChatMessage[]): Promise<any> {
    return this.chatApi.syncChatSession(session, messages);
  }
  deleteChatSession(id: string): Promise<void> {
    return this.chatApi.deleteChatSession(id);
  }
  sendMessageFeedback(messageId: string, rating: 'like' | 'dislike', content?: string): Promise<void> {
    return this.chatApi.sendMessageFeedback(messageId, rating, content);
  }

  voiceTTS(
    text: string,
    voice?: string
  ): Promise<{ audio_b64: string; mime: string; voice: string }> {
    return this.chatApi.voiceTTS(text, voice);
  }

  // Pendências
  getPendingItems(status?: PendingStatus, category?: string): Promise<PendingItem[]> {
    return this.pendingApi.getPendingItems(status, category);
  }
  createPendingItem(data: CreatePendingInput): Promise<PendingItem> {
    return this.pendingApi.createPendingItem(data);
  }
  updatePendingItem(id: string, data: UpdatePendingInput): Promise<PendingItem> {
    return this.pendingApi.updatePendingItem(id, data);
  }
  schedulePendingItem(id: string, scheduledDate: string): Promise<PendingItem> {
    return this.pendingApi.schedulePendingItem(id, scheduledDate);
  }
  completePendingItem(id: string): Promise<PendingItem> {
    return this.pendingApi.completePendingItem(id);
  }
  deletePendingItem(id: string): Promise<void> {
    return this.pendingApi.deletePendingItem(id);
  }

  // Booking
  getBookingTypes(): Promise<BookingType[]> {
    return this.bookingApi.getBookingTypes();
  }
  updateBookingType(id: string, data: Partial<BookingType>): Promise<BookingType> {
    return this.bookingApi.updateBookingType(id, data);
  }
  deleteBookingType(id: string): Promise<DeleteBookingImpact> {
    return this.bookingApi.deleteBookingType(id);
  }
  getBookingAppointments(): Promise<BookingAppointment[]> {
    return this.bookingApi.getBookingAppointments();
  }
  deleteBookingAppointment(id: string): Promise<void> {
    return this.bookingApi.deleteBookingAppointment(id);
  }

  // Meetings
  getMeetings(status?: string): Promise<MeetingWithDetails[]> {
    return this.meetingsApi.getMeetings(status);
  }
  deleteMeeting(id: string): Promise<void> {
    return this.meetingsApi.deleteMeeting(id);
  }
  confirmMeetingConsensus(id: string, slotId: string): Promise<{ status: string }> {
    return this.meetingsApi.confirmConsensus(id, slotId);
  }

  // Phone Verification
  requestPhoneVerification(phone: string) {
    return this.phoneVerificationApi.requestPhoneVerification(phone);
  }
  verifyPhoneCode(payload: { code?: string; token?: string }) {
    return this.phoneVerificationApi.verifyPhoneCode(payload);
  }

  // Notifications & AI Settings
  registerPushToken(token: string, platform: string = 'expo'): Promise<{ status: string; token: string }> {
    return this.notificationsApi.registerPushToken(token, platform);
  }
  revokePushToken(token: string): Promise<{ status: string; token: string }> {
    return this.notificationsApi.revokePushToken(token);
  }
  getAISettings(): Promise<AISettings> {
    return this.aiSettingsApi.getAISettings();
  }
  updateAISettings(data: Parameters<AiSettingsApi['updateAISettings']>[0]): Promise<AISettings> {
    return this.aiSettingsApi.updateAISettings(data);
  }

  // WhatsApp (Evolution API v2)
  getWhatsAppStatus = (): Promise<WhatsAppIntegrationStatus> => this.whatsappApi.getStatus();
  requestWhatsAppPairingCode = (phone: string): Promise<{ pairing_code: string; status: string }> =>
    this.whatsappApi.requestPairingCode(phone);
  disconnectWhatsApp = (): Promise<{ message: string; status: string }> => this.whatsappApi.disconnect();
  get whatsapp(): WhatsAppApi {
    return this.whatsappApi;
  }

  // WhatsApp Auth (Passwordless OTP & Account Linking)
  requestWhatsAppOTP(phone: string): Promise<RequestWhatsAppOTPResponse> {
    return this.whatsappAuthApi.requestOTP(phone);
  }
  verifyWhatsAppOTP(phone: string, code: string, deviceName?: string): Promise<VerifyWhatsAppOTPResponse> {
    return this.whatsappAuthApi.verifyOTP(phone, code, deviceName);
  }
  linkWhatsAppPhone(phone: string): Promise<{ data: { status: string; message: string } }> {
    return this.whatsappAuthApi.linkPhone(phone);
  }

  // Gmail Integration & Scanning
  getGmailStatus(): Promise<GmailStatusResponse> {
    return this.gmailApi.getStatus();
  }
  scanGmail(params?: { days?: number; limit?: number }): Promise<GmailScanResult> {
    return this.gmailApi.scanEmails(params);
  }
  disconnectGmail(): Promise<{ message: string }> {
    return this.gmailApi.disconnect();
  }
  get gmail(): GmailApi {
    return this.gmailApi;
  }

  // Finance & Open Finance (Vito Finance MVP)
  get finance(): FinanceApi { return this.financeApi; }
  get aiProviders(): AiProvidersApi { return this.aiProvidersApi; }
  get inbox(): NotificationsApi { return this.notificationsApi; }
  get store(): StoreComplianceApi { return this.storeComplianceApi; }
}

export const api = new ApiService();
export default api;
