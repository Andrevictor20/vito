import { ApiClient, PI_SERVER_URL, CLOUDFLARE_SERVER_URL, DEFAULT_SERVER_URL, isCloudServer } from './client';
import { fileUriToBase64 } from './fileUtils';
import { ApiRequestOptions, ChatHistoryItem, AssistantChatOptions } from './types';
import { AuthApi } from './authApi';
import { CalendarApi } from './calendarApi';
import { TodosApi } from './todosApi';
import { ChatApi } from './chatApi';
import { TriggersApi } from './triggersApi';
import { PendingApi } from './pendingApi';
import { BookingApi } from './bookingApi';
import { MeetingsApi } from './meetingsApi';
import { P2PMeetingsApi } from './p2pMeetingsApi';
import { NotificationsApi } from './notificationsApi';
import { WhatsAppApi, WhatsAppIntegrationStatus } from './whatsappApi';
import {
  WhatsAppContextApi,
  WhatsAppContextScope,
  WhatsAppContextSettings,
  WhatsAppContextPreview,
} from './whatsappContextApi';
import {
  GmailApi,
  GmailStatusResponse,
  GmailScanResult,
  GmailDraftInput,
  GmailDraftResponse,
  ScannedBill,
  ScannedFlight,
  UrgentEmail,
} from './gmailApi';
import {
  WhatsAppAuthApi,
  RequestWhatsAppOTPResponse,
  VerifyWhatsAppOTPResponse,
} from './whatsappAuthApi';
import {
  User,
  AuthResponse,
  Event,
  Todo,
  Subtask,
  AssistantChatResponse,
  ConflictInfo,
  Trigger,
  TriggerCategory,
  TriggerLog,
  TriggerTestResult,
  TriggerStatus,
  CreateTriggerInput,
  TriggerTemplate,
  MorningBriefingSettings,
  AutonomyMode,
  AISettings,
  PendingItem,
  PendingStatus,
  CreatePendingInput,
  UpdatePendingInput,
  BookingType,
  BookingAppointment,
  CreateBookingTypeInput,
  DeleteBookingImpact,
  Meeting,
  MeetingWithDetails,
  CreateMeetingInput,
  WhatsAppShareData,
  ChatMessage,
  ConversationSession,
  P2PMeetingInvite,
  ContactMatchResult,
  P2PMutualSlot,
  SendP2PInviteInput,
  UserSession,
} from '../../types';

export {
  PI_SERVER_URL,
  CLOUDFLARE_SERVER_URL,
  DEFAULT_SERVER_URL,
  isCloudServer,
  fileUriToBase64,
  ApiRequestOptions,
  ChatHistoryItem,
  AssistantChatOptions,
  WhatsAppIntegrationStatus,
  GmailStatusResponse,
  GmailScanResult,
  GmailDraftInput,
  GmailDraftResponse,
  ScannedBill,
  ScannedFlight,
  UrgentEmail,
  RequestWhatsAppOTPResponse,
  VerifyWhatsAppOTPResponse,
};

export class ApiService extends ApiClient {
  private authApi = new AuthApi(this);
  private calendarApi = new CalendarApi(this);
  private todosApi = new TodosApi(this);
  private chatApi = new ChatApi(this);
  private triggersApi = new TriggersApi(this);
  private pendingApi = new PendingApi(this);
  private bookingApi = new BookingApi(this);
  private meetingsApi = new MeetingsApi(this);
  private p2pMeetingsApi = new P2PMeetingsApi(this);
  private notificationsApi = new NotificationsApi(this);
  private whatsappApi = new WhatsAppApi(this);
  private gmailApi = new GmailApi(this);
  private whatsappAuthApi = new WhatsAppAuthApi(this);
  private whatsappContextApi = new WhatsAppContextApi(this);

  // Auth & Sessions
  login(email: string, password: string): Promise<AuthResponse> {
    return this.authApi.login(email, password);
  }
  register(name: string, email: string, password: string): Promise<AuthResponse> {
    return this.authApi.register(name, email, password);
  }
  getMe(): Promise<{ user: User }> {
    return this.authApi.getMe();
  }
  getSessions(): Promise<{ sessions: UserSession[] }> {
    return this.authApi.getSessions();
  }
  revokeSession(sessionId: string): Promise<{ status: string }> {
    return this.authApi.revokeSession(sessionId);
  }
  revokeOtherSessions(): Promise<{ status: string }> {
    return this.authApi.revokeOtherSessions();
  }
  logoutSession(): Promise<{ status: string }> {
    return this.authApi.logoutSession();
  }

  // Calendar
  getEvents(): Promise<Event[]> {
    return this.calendarApi.getEvents();
  }
  createEvent(event: { title: string; description?: string; location?: string; start_at: string; end_at: string; recurrence?: string }) {
    return this.calendarApi.createEvent(event);
  }
  updateEvent(id: string, eventData: Partial<Event> & { update_series?: boolean }): Promise<{ event: Event; updated_count: number }> {
    return this.calendarApi.updateEvent(id, eventData);
  }
  deleteEvent(id: string, allSeries: boolean = false): Promise<void> {
    return this.calendarApi.deleteEvent(id, allSeries);
  }
  syncCalendar(provider: string = 'google'): Promise<{ status: string; provider: string }> {
    return this.calendarApi.syncCalendar(provider);
  }

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
  assistantAudio(audioUri: string, filename: string = 'audio.m4a', options?: string | AssistantChatOptions): Promise<AssistantChatResponse> {
    return this.chatApi.assistantAudio(audioUri, filename, options);
  }
  assistantVision(
    imageUri: string,
    prompt?: string,
    filename: string = 'image.jpg',
    timezone?: string,
    base64Override?: string
  ): Promise<AssistantChatResponse> {
    return this.chatApi.assistantVision(imageUri, prompt, filename, timezone, base64Override);
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

  // Triggers / Radares
  getTriggers(category?: TriggerCategory, status?: TriggerStatus): Promise<Trigger[]> {
    return this.triggersApi.getTriggers(category, status);
  }
  getTrigger(id: string): Promise<Trigger> {
    return this.triggersApi.getTrigger(id);
  }
  createTrigger(input: CreateTriggerInput): Promise<Trigger> {
    return this.triggersApi.createTrigger(input);
  }
  toggleTrigger(id: string): Promise<Trigger> {
    return this.triggersApi.toggleTrigger(id);
  }
  updateTrigger(
    id: string,
    input: Partial<CreateTriggerInput> & {
      status?: TriggerStatus;
      scheduled_time?: string;
      days_of_week?: string;
    }
  ): Promise<Trigger> {
    return this.triggersApi.updateTrigger(id, input);
  }
  testTrigger(id: string): Promise<TriggerTestResult> {
    return this.triggersApi.testTrigger(id);
  }
  runTrigger(id: string): Promise<TriggerLog> {
    return this.triggersApi.runTrigger(id);
  }
  deleteTrigger(id: string): Promise<void> {
    return this.triggersApi.deleteTrigger(id);
  }
  deleteTriggerLog(triggerId: string, logId: string): Promise<void> {
    return this.triggersApi.deleteTriggerLog(triggerId, logId);
  }
  clearTriggerLogs(triggerId: string): Promise<void> {
    return this.triggersApi.clearTriggerLogs(triggerId);
  }
  parseTriggerPrompt(prompt: string): Promise<{
    category: TriggerCategory;
    suggested_title: string;
    query: string;
    condition_type: string;
  }> {
    return this.triggersApi.parseTriggerPrompt(prompt);
  }
  getTriggerLogs(id: string): Promise<TriggerLog[]> {
    return this.triggersApi.getTriggerLogs(id);
  }
  getTriggerTemplates(): Promise<TriggerTemplate[]> {
    return this.triggersApi.getTemplates();
  }
  activateTriggerTemplate(
    templateId: string,
    overrides?: { title?: string; query?: string; target_value?: string }
  ): Promise<Trigger> {
    return this.triggersApi.activateTemplate(templateId, overrides);
  }

  // Pendências
  getPendingItems(status?: PendingStatus, category?: string): Promise<PendingItem[]> {
    return this.pendingApi.getPendingItems(status, category);
  }
  createPendingItem(data: CreatePendingInput): Promise<PendingItem> {
    return this.pendingApi.createPendingItem(data);
  }
  getPendingItem(id: string): Promise<PendingItem> {
    return this.pendingApi.getPendingItem(id);
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
  createBookingType(data: CreateBookingTypeInput): Promise<BookingType> {
    return this.bookingApi.createBookingType(data);
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
  getMeeting(id: string): Promise<MeetingWithDetails> {
    return this.meetingsApi.getMeeting(id);
  }
  createMeeting(data: CreateMeetingInput): Promise<MeetingWithDetails> {
    return this.meetingsApi.createMeeting(data);
  }
  updateMeeting(id: string, data: { title: string; description?: string; duration_minutes: number; slots: { start_at: string; end_at: string }[] }): Promise<MeetingWithDetails> {
    return this.meetingsApi.updateMeeting(id, data);
  }
  deleteMeeting(id: string): Promise<void> {
    return this.meetingsApi.deleteMeeting(id);
  }
  confirmMeetingConsensus(id: string, slotId: string): Promise<{ status: string }> {
    return this.meetingsApi.confirmConsensus(id, slotId);
  }
  getMeetingWhatsAppShare(id: string): Promise<WhatsAppShareData> {
    return this.meetingsApi.getWhatsAppShare(id);
  }

  // P2P Meetings & Contacts
  getP2PChallenge(): Promise<{ salt: string }> {
    return this.p2pMeetingsApi.getChallenge();
  }
  matchP2PContacts(salt: string, hashes: string[]): Promise<ContactMatchResult[]> {
    return this.p2pMeetingsApi.matchContacts(salt, hashes);
  }
  updateP2PPhone(phone: string): Promise<{ status: string; phone?: string }> {
    return this.p2pMeetingsApi.updatePhone(phone);
  }

  updatePhone(phone: string): Promise<{ status: string; phone?: string }> {
    return this.updateP2PPhone(phone);
  }

  requestPhoneVerification(phone: string) {
    return this.p2pMeetingsApi.requestPhoneVerification(phone);
  }

  verifyPhoneCode(payload: { code?: string; token?: string }) {
    return this.p2pMeetingsApi.verifyPhoneCode(payload);
  }
  getP2PMutualSlots(targetUserId: string, from?: string, to?: string, duration?: number): Promise<P2PMutualSlot[]> {
    return this.p2pMeetingsApi.getMutualSlots(targetUserId, from, to, duration);
  }
  sendP2PInvite(data: SendP2PInviteInput): Promise<P2PMeetingInvite> {
    return this.p2pMeetingsApi.sendInvite(data);
  }
  getP2PPendingInvites(): Promise<P2PMeetingInvite[]> {
    return this.p2pMeetingsApi.getPendingInvites();
  }
  getP2PInvites(): Promise<P2PMeetingInvite[]> {
    return this.p2pMeetingsApi.getInvites();
  }
  acceptP2PInvite(id: string): Promise<P2PMeetingInvite> {
    return this.p2pMeetingsApi.acceptInvite(id);
  }
  declineP2PInvite(id: string): Promise<{ status: string }> {
    return this.p2pMeetingsApi.declineInvite(id);
  }
  cancelP2PInvite(id: string): Promise<{ status: string }> {
    return this.p2pMeetingsApi.cancelInvite(id);
  }

  get p2p(): P2PMeetingsApi {
    return this.p2pMeetingsApi;
  }

  // Notifications & Briefing & Settings
  registerPushToken(token: string, platform: string = 'expo'): Promise<{ status: string; token: string }> {
    return this.notificationsApi.registerPushToken(token, platform);
  }
  revokePushToken(token: string): Promise<{ status: string; token: string }> {
    return this.notificationsApi.revokePushToken(token);
  }
  getNotificationStatus(): Promise<{ registered: boolean; device_count: number }> {
    return this.notificationsApi.getNotificationStatus();
  }
  testPushNotification(priority?: 'default' | 'silent', title?: string, body?: string): Promise<{ status: string; dispatched: number }> {
    return this.notificationsApi.testPushNotification(priority, title, body);
  }
  getBriefingSettings(): Promise<MorningBriefingSettings> {
    return this.notificationsApi.getBriefingSettings();
  }
  updateBriefingSettings(data: Partial<MorningBriefingSettings>): Promise<MorningBriefingSettings> {
    return this.notificationsApi.updateBriefingSettings(data);
  }
  getAISettings(): Promise<AISettings> {
    return this.notificationsApi.getAISettings();
  }
  updateAISettings(data: { autonomy_mode?: AutonomyMode; auto_focus_blocks?: boolean }): Promise<AISettings> {
    return this.notificationsApi.updateAISettings(data);
  }

  // WhatsApp (Evolution API v2)
  getWhatsAppStatus(): Promise<WhatsAppIntegrationStatus> {
    return this.whatsappApi.getStatus();
  }
  requestWhatsAppPairingCode(phone: string): Promise<{ pairing_code: string; status: string }> {
    return this.whatsappApi.requestPairingCode(phone);
  }
  disconnectWhatsApp(): Promise<{ message: string; status: string }> {
    return this.whatsappApi.disconnect();
  }
  getWhatsAppContacts(): Promise<{ contacts: import('./whatsappApi').WhatsAppMatchedContact[]; count: number }> {
    return this.whatsappApi.getContacts();
  }
  getWhatsAppContextSettings(): Promise<WhatsAppContextSettings> {
    return this.whatsappContextApi.getSettings();
  }
  getWhatsAppContextPreview(): Promise<WhatsAppContextPreview> {
    return this.whatsappContextApi.getPreview();
  }
  updateWhatsAppContextSettings(
    scope: WhatsAppContextScope,
    windowSize: number,
  ): Promise<WhatsAppContextSettings> {
    return this.whatsappContextApi.updateSettings(scope, windowSize);
  }
  purgeWhatsAppContextMessages(): Promise<{ message: string }> {
    return this.whatsappContextApi.purgeMessages();
  }
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
  createGmailDraft(draft: GmailDraftInput): Promise<GmailDraftResponse> {
    return this.gmailApi.createDraft(draft);
  }
  get gmail(): GmailApi {
    return this.gmailApi;
  }
}

export const api = new ApiService();
export default api;
