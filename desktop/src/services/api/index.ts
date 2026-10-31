import { ApiClient, getDesktopDeviceName } from './client';
import { AuthApi } from './authApi';
import { CalendarApi } from './calendarApi';
import { TodosApi } from './todosApi';
import { ChatApi } from './chatApi';
import { TriggersApi } from './triggersApi';
import { BookingApi } from './bookingApi';
import { MeetingsApi } from './meetingsApi';
import { IntegrationsApi } from './integrationsApi';
import { PendingApi } from './pendingApi';
import { MemoriesApi } from './memoriesApi';
import { WhatsAppApi, WhatsAppIntegrationStatus, WhatsAppMatchedContact } from './whatsappApi';
import { WhatsAppAuthApi, RequestWhatsAppOTPResponse, VerifyWhatsAppOTPResponse, LinkPhoneResponse } from './whatsappAuthApi';
import { WhatsAppContextApi, WhatsAppContextScope, WhatsAppContextSettings, WhatsAppContextPreview, WhatsAppDirectory } from './whatsappContextApi';
import { GmailApi, GmailStatusResponse, GmailScanResult, GmailDraftInput, GmailDraftResponse, GmailSendResponse } from './gmailApi';
import { P2PMeetingsApi, P2PMeetingInvite, ContactMatchResult, P2PMutualSlot, SendP2PInviteInput } from './p2pMeetingsApi';
import { NotificationsApi } from './notificationsApi';
import { fileUriToBase64 } from './fileUtils';
import {
  User,
  AuthTokens,
  SessionDevice,
  CalendarEvent,
  Todo,
  Subtask,
  Trigger,
  TriggerLog,
  BookingType,
  Meeting,
  ConversationSession,
  ChatMessage,
  WhatsAppStatus,
  GmailStatus,
  PendingItem,
  AISettings,
  MorningBriefingSettings,
} from '../../types';

export {
  getDesktopDeviceName,
  fileUriToBase64,
  WhatsAppApi,
  WhatsAppAuthApi,
  WhatsAppContextApi,
  GmailApi,
  P2PMeetingsApi,
  NotificationsApi,
};

export type {
  WhatsAppIntegrationStatus,
  WhatsAppMatchedContact,
  RequestWhatsAppOTPResponse,
  VerifyWhatsAppOTPResponse,
  LinkPhoneResponse,
  WhatsAppContextScope,
  WhatsAppContextSettings,
  WhatsAppContextPreview,
  WhatsAppDirectory,
  GmailStatusResponse,
  GmailScanResult,
  GmailDraftInput,
  GmailDraftResponse,
  GmailSendResponse,
  P2PMeetingInvite,
  ContactMatchResult,
  P2PMutualSlot,
  SendP2PInviteInput,
};

export class ApiService extends ApiClient {
  public authApi = new AuthApi(this);
  public calendarApi = new CalendarApi(this);
  public todosApi = new TodosApi(this);
  public chatApi = new ChatApi(this);
  public triggersApi = new TriggersApi(this);
  public bookingApi = new BookingApi(this);
  public meetingsApi = new MeetingsApi(this);
  public integrationsApi = new IntegrationsApi(this);
  public pendingApi = new PendingApi(this);
  public memoriesApi = new MemoriesApi(this);
  public whatsappApi = new WhatsAppApi(this);
  public whatsappAuthApi = new WhatsAppAuthApi(this);
  public whatsappContextApi = new WhatsAppContextApi(this);
  public gmailApi = new GmailApi(this);
  public p2pMeetingsApi = new P2PMeetingsApi(this);
  public notificationsApi = new NotificationsApi(this);

  public getToken(): string | null {
    return this.accessToken;
  }

  // --- Auth & Sessions ---
  login(email: string, password: string, deviceName?: string): Promise<AuthTokens> {
    return this.authApi.login(email, password, deviceName);
  }
  register(name: string, email: string, password: string, deviceName?: string): Promise<AuthTokens> {
    return this.authApi.register(name, email, password, deviceName);
  }
  logout(): Promise<void> {
    return this.authApi.logout();
  }
  getMe(): Promise<User> {
    return this.authApi.getMe();
  }
  getSessions(): Promise<SessionDevice[]> {
    return this.authApi.getSessions();
  }
  revokeSession(id: string): Promise<void> {
    return this.authApi.revokeSession(id);
  }
  requestWhatsAppOTP(phone: string): Promise<RequestWhatsAppOTPResponse> {
    return this.whatsappAuthApi.requestOTP(phone);
  }
  verifyWhatsAppOTP(phone: string, code: string, deviceName?: string): Promise<VerifyWhatsAppOTPResponse> {
    return this.whatsappAuthApi.verifyOTP(phone, code, deviceName);
  }
  linkWhatsAppPhone(phone: string): Promise<LinkPhoneResponse> {
    return this.whatsappAuthApi.linkPhone(phone);
  }

  // --- Calendar ---
  getEvents(): Promise<CalendarEvent[]> {
    return this.calendarApi.getEvents();
  }
  createEvent(event: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return this.calendarApi.createEvent(event);
  }
  updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent> {
    return this.calendarApi.updateEvent(id, updates);
  }
  deleteEvent(id: string): Promise<void> {
    return this.calendarApi.deleteEvent(id);
  }
  syncCalendar(provider: string = 'google'): Promise<{ status: string; provider: string }> {
    return this.calendarApi.syncCalendar(provider);
  }

  // --- Todos ---
  getTodos(status?: string): Promise<Todo[]> {
    return this.todosApi.getTodos(status);
  }
  createTodo(todo: Partial<Todo>): Promise<Todo> {
    return this.todosApi.createTodo(todo);
  }
  updateTodo(id: string, updates: Partial<Todo>): Promise<Todo> {
    return this.todosApi.updateTodo(id, updates);
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
  addSubtask(todoId: string, title: string): Promise<Subtask> {
    return this.todosApi.addSubtask(todoId, title);
  }
  toggleSubtask(todoId: string, subtaskId: string): Promise<Subtask> {
    return this.todosApi.toggleSubtask(todoId, subtaskId);
  }
  deleteSubtask(todoId: string, subtaskId: string): Promise<void> {
    return this.todosApi.deleteSubtask(todoId, subtaskId);
  }

  // --- Assistant & Chat ---
  askAssistant(prompt: string, context?: any): Promise<any> {
    return this.chatApi.assistantChat(prompt, context);
  }
  assistantChat(prompt: string, context?: any): Promise<any> {
    return this.chatApi.assistantChat(prompt, context);
  }
  assistantAudio(audioB64: string, filename?: string, context?: any): Promise<any> {
    return this.chatApi.assistantAudio(audioB64, filename, context);
  }
  assistantVision(imageB64: string, mimeType?: string, prompt?: string, context?: any): Promise<any> {
    return this.chatApi.assistantVision(imageB64, mimeType, prompt, context);
  }
  getChatSessions(): Promise<ConversationSession[]> {
    return this.chatApi.getChatSessions();
  }
  getChatSessionWithMessages(id: string): Promise<{ session: ConversationSession; messages: ChatMessage[] } | null> {
    return this.chatApi.getChatSessionWithMessages(id);
  }
  deleteChatSession(id: string): Promise<void> {
    return this.chatApi.deleteChatSession(id);
  }
  syncChatSession(session: any, messages: any[]): Promise<any> {
    return this.chatApi.syncChatSession(session, messages);
  }

  // --- Triggers / Radares ---
  getTriggers(): Promise<Trigger[]> {
    return this.triggersApi.getTriggers();
  }
  getTrigger(id: string): Promise<Trigger> {
    return this.triggersApi.getTrigger(id);
  }
  createTrigger(input: Partial<Trigger> & { title: string; query: string }): Promise<Trigger> {
    return this.triggersApi.createTrigger(input);
  }
  updateTrigger(id: string, updates: Partial<Trigger>): Promise<Trigger> {
    return this.triggersApi.updateTrigger(id, updates);
  }
  deleteTrigger(id: string): Promise<void> {
    return this.triggersApi.deleteTrigger(id);
  }
  getTriggerLogs(id: string): Promise<TriggerLog[]> {
    return this.triggersApi.getTriggerLogs(id);
  }
  deleteTriggerLog(triggerId: string, logId: string): Promise<void> {
    return this.triggersApi.deleteTriggerLog(triggerId, logId);
  }
  clearTriggerLogs(triggerId: string): Promise<void> {
    return this.triggersApi.clearTriggerLogs(triggerId);
  }
  testTrigger(id: string): Promise<any> {
    return this.triggersApi.testTrigger(id);
  }
  runTrigger(id: string): Promise<TriggerLog> {
    return this.triggersApi.runTrigger(id);
  }
  toggleTrigger(id: string, active?: boolean): Promise<any> {
    return this.triggersApi.toggleTrigger(id, active ?? true);
  }
  getTriggerTemplates(): Promise<any[]> {
    return this.triggersApi.getTriggerTemplates();
  }
  activateTriggerTemplate(templateId: string): Promise<Trigger> {
    return this.triggersApi.activateTriggerTemplate(templateId);
  }

  // --- Booking & Appointments ---
  getBookingTypes(): Promise<BookingType[]> {
    return this.bookingApi.getBookingTypes();
  }
  getBookings(): Promise<BookingType[]> {
    return this.bookingApi.getBookings();
  }
  createBookingType(data: Partial<BookingType>): Promise<BookingType> {
    return this.bookingApi.createBookingType(data);
  }
  updateBookingType(id: string, data: Partial<BookingType>): Promise<BookingType> {
    return this.bookingApi.updateBookingType(id, data);
  }
  deleteBookingType(id: string): Promise<void> {
    return this.bookingApi.deleteBookingType(id);
  }
  getBookingAppointments(): Promise<any[]> {
    return this.bookingApi.getBookingAppointments();
  }
  deleteBookingAppointment(id: string): Promise<void> {
    return this.bookingApi.deleteBookingAppointment(id);
  }

  // --- Meetings ---
  getMeetings(status?: string): Promise<Meeting[]> {
    return this.meetingsApi.getMeetings(status);
  }
  getMeeting(id: string): Promise<Meeting> {
    return this.meetingsApi.getMeeting(id);
  }
  createMeeting(data: Partial<Meeting>): Promise<Meeting> {
    return this.meetingsApi.createMeeting(data);
  }
  updateMeeting(id: string, data: Partial<Meeting>): Promise<Meeting> {
    return this.meetingsApi.updateMeeting(id, data);
  }
  deleteMeeting(id: string): Promise<void> {
    return this.meetingsApi.deleteMeeting(id);
  }
  confirmMeetingConsensus(meetingId: string, slotId: string): Promise<{ status: string }> {
    return this.meetingsApi.confirmMeetingConsensus(meetingId, slotId);
  }
  getMeetingWhatsAppShare(id: string): Promise<any> {
    return this.meetingsApi.getMeetingWhatsAppShare(id);
  }

  // --- Integrations: WhatsApp ---
  getWhatsAppStatus(): Promise<WhatsAppStatus> {
    return this.whatsappApi.getStatus() as Promise<WhatsAppStatus>;
  }
  requestWhatsAppPairingCode(phone: string): Promise<{ pairing_code: string; status: string }> {
    return this.whatsappApi.requestPairingCode(phone);
  }
  disconnectWhatsApp(): Promise<{ message: string; status: string }> {
    return this.whatsappApi.disconnect();
  }
  getWhatsAppContacts(): Promise<{ contacts: WhatsAppMatchedContact[]; count: number }> {
    return this.whatsappApi.getContacts();
  }
  importWhatsAppContactNames(names: { phone: string; name: string }[]): Promise<{ imported: number }> {
    return this.whatsappContextApi.importContactNames(names);
  }

  // --- Integrations: Gmail ---
  getGmailStatus(): Promise<GmailStatus> {
    return this.gmailApi.getStatus() as Promise<GmailStatus>;
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
  sendGmailEmail(email: GmailDraftInput): Promise<GmailSendResponse> {
    return this.gmailApi.sendEmail(email);
  }

  // --- Settings & Notifications ---
  getAISettings(): Promise<AISettings> {
    return this.notificationsApi.getAISettings();
  }
  updateAISettings(data: Partial<AISettings>): Promise<AISettings> {
    return this.notificationsApi.updateAISettings(data);
  }
  getBriefingSettings(): Promise<MorningBriefingSettings> {
    return this.notificationsApi.getBriefingSettings();
  }
  updateBriefingSettings(data: Partial<MorningBriefingSettings>): Promise<MorningBriefingSettings> {
    return this.notificationsApi.updateBriefingSettings(data);
  }
  getNotificationStatus(): Promise<{ registered: boolean; device_count: number }> {
    return this.notificationsApi.getNotificationStatus();
  }
  registerDeviceToken(token: string, platform = 'web'): Promise<{ status: string }> {
    return this.notificationsApi.registerPushToken(token, platform);
  }
  testNotification(priority = 'default', title?: string, body?: string): Promise<any> {
    return this.notificationsApi.testPushNotification(priority as 'default' | 'silent', title, body);
  }

  // --- Pendências ---
  getPendingItems(status?: string, category?: string): Promise<PendingItem[]> {
    return this.pendingApi.getPendingItems(status, category);
  }
  createPendingItem(data: Partial<PendingItem>): Promise<PendingItem> {
    return this.pendingApi.createPendingItem(data);
  }
  getPendingItem(id: string): Promise<PendingItem> {
    return this.pendingApi.getPendingItem(id);
  }
  updatePendingItem(id: string, data: Partial<PendingItem>): Promise<PendingItem> {
    return this.pendingApi.updatePendingItem(id, data);
  }
  schedulePendingItem(id: string, date: string): Promise<PendingItem> {
    return this.pendingApi.schedulePendingItem(id, date);
  }
  completePendingItem(id: string): Promise<PendingItem> {
    return this.pendingApi.completePendingItem(id);
  }
  deletePendingItem(id: string): Promise<void> {
    return this.pendingApi.deletePendingItem(id);
  }

  // --- Sub-Namespaces ---
  get whatsapp(): WhatsAppApi {
    return this.whatsappApi;
  }
  get gmail(): GmailApi {
    return this.gmailApi;
  }
  get p2p(): P2PMeetingsApi {
    return this.p2pMeetingsApi;
  }
  get pending(): PendingApi {
    return this.pendingApi;
  }
  get triggers(): TriggersApi {
    return this.triggersApi;
  }
  get calendar(): CalendarApi {
    return this.calendarApi;
  }
  get todos(): TodosApi {
    return this.todosApi;
  }
  get booking(): BookingApi {
    return this.bookingApi;
  }
  get meetings(): MeetingsApi {
    return this.meetingsApi;
  }
  get notifications(): NotificationsApi {
    return this.notificationsApi;
  }
}

export const api = new ApiService();
export default api;
