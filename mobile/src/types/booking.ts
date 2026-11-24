export interface BookingType {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  description?: string;
  duration_minutes: number;
  buffer_minutes: number;
  days_of_week: string;
  start_hour: string;
  end_hour: string;
  valid_from?: string | null;
  valid_until?: string | null;
  allowed_dates?: string | null;
  is_active: boolean;
  public_url?: string;
  short_url?: string;
  created_at: string;
  updated_at: string;
}

export interface DeleteBookingImpact {
  deleted_appointments: number;
  deleted_events: number;
}

export interface BookingAppointment {
  id: string;
  booking_type_id: string;
  user_id: string;
  guest_name: string;
  guest_email: string;
  guest_notes?: string;
  start_at: string;
  end_at: string;
  status: 'confirmed' | 'cancelled';
  event_id?: string;
  created_at: string;
}

export type BookingValidityPreset = '7d' | '14d' | '30d' | 'none';

export interface CreateBookingTypeInput {
  slug: string;
  title: string;
  description?: string;
  duration_minutes?: number;
  buffer_minutes?: number;
  days_of_week?: string;
  start_hour?: string;
  end_hour?: string;
  valid_from?: string | null;
  valid_until?: string | null;
  allowed_dates?: string | null;
}

export interface MeetingSlot {
  id: string;
  meeting_id: string;
  start_at: string;
  end_at: string;
  votes_count: number;
  voter_names?: string[];
  is_winner?: boolean;
  created_at: string;
}

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  name: string;
  contact_info?: string;
  vito_user_id?: string;
  voted_slot_ids?: string[];
  responded_at: string;
  created_at: string;
}

export interface Meeting {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  duration_minutes: number;
  mode: 'one_on_one' | 'group_consensus';
  status: 'open' | 'confirmed' | 'expired' | 'cancelled';
  short_url?: string;
  public_url?: string;
  expires_at: string;
  confirmed_slot_id?: string;
  confirmed_slot_start?: string;
  confirmed_slot_end?: string;
  slots?: MeetingSlot[];
  participants?: MeetingParticipant[];
  created_at: string;
  updated_at: string;
}

export interface MeetingWithDetails extends Meeting {
  slots: MeetingSlot[];
  participants: MeetingParticipant[];
  public_url?: string;
}

export interface CreateMeetingInput {
  title: string;
  description?: string;
  duration_minutes: number;
  mode?: 'one_on_one' | 'group_consensus';
  expires_at?: string;
  slots: { start_at: string; end_at: string }[];
}

export interface UpdateMeetingInput {
  title: string;
  description?: string;
  duration_minutes: number;
  slots: { start_at: string; end_at: string }[];
}

export interface WhatsAppShareData {
  message_text: string;
  whatsapp_deep_link: string;
  whatsapp_web_url: string;
}

export interface P2PMeetingInvite {
  id: string;
  from_user_id: string;
  to_user_id: string;
  title: string;
  description?: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  event_id_from?: string;
  event_id_to?: string;
  from_user_name?: string;
  to_user_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ContactMatchResult {
  user_id: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface P2PMutualSlot {
  start_at: string;
  end_at: string;
}

export interface SendP2PInviteInput {
  to_user_id: string;
  title: string;
  description?: string;
  start_at: string;
  end_at: string;
}