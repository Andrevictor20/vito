import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar';

export interface NativeCalendarInfo {
  id: string;
  title: string;
  isPrimary?: boolean;
}

export const nativeCalendarService = {
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return false;
    }
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  },

  async hasPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return false;
    }
    const { status } = await Calendar.getCalendarPermissionsAsync();
    return status === 'granted';
  },

  async getCalendars(): Promise<NativeCalendarInfo[]> {
    if (Platform.OS === 'web') {
      return [];
    }
    const granted = await this.hasPermissions();
    if (!granted) {
      return [];
    }

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    return calendars.map((c) => ({
      id: c.id,
      title: c.title,
      isPrimary: c.isPrimary,
    }));
  },

  async getOrCreateVitoCalendar(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return null;
    }
    const granted = await this.requestPermissions();
    if (!granted) {
      return null;
    }

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const existing = calendars.find((c) => c.title.toLowerCase() === 'vito');
    if (existing) {
      return existing.id;
    }

    // Cria calendário local dedicado no iOS/Android
    const defaultCalendar = calendars.find((c) => c.isPrimary) || calendars[0];
    const sourceId = defaultCalendar?.source?.id;

    const newCalendarId = await Calendar.createCalendarAsync({
      title: 'Vito',
      color: '#4D8EFF',
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: sourceId,
      source: defaultCalendar?.source || {
        isLocalAccount: true,
        name: 'Vito',
        type: Calendar.SourceType.LOCAL,
      },
      name: 'vito_calendar',
      ownerAccount: 'vito',
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });

    return newCalendarId;
  },
};
