import { Platform } from 'react-native';

// Carregamento defensivo do módulo nativo para evitar crash em compilações onde o nativo não está linkado
let Calendar: any = null;
try {
  Calendar = require('expo-calendar');
} catch (e) {
  Calendar = null;
}

export interface NativeCalendarInfo {
  id: string;
  title: string;
  isPrimary?: boolean;
}

export const nativeCalendarService = {
  isAvailable(): boolean {
    return Platform.OS !== 'web' && Calendar !== null;
  },

  async requestPermissions(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  },

  async hasPermissions(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    try {
      const { status } = await Calendar.getCalendarPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  },

  async getCalendars(): Promise<NativeCalendarInfo[]> {
    if (!this.isAvailable()) {
      return [];
    }
    try {
      const granted = await this.hasPermissions();
      if (!granted) {
        return [];
      }

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      return (calendars || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        isPrimary: c.isPrimary,
      }));
    } catch {
      return [];
    }
  },

  async getOrCreateVitoCalendar(): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }
    try {
      const granted = await this.requestPermissions();
      if (!granted) {
        return null;
      }

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const existing = (calendars || []).find((c: any) => c.title?.toLowerCase() === 'vito');
      if (existing) {
        return existing.id;
      }

      // Cria calendário local dedicado no iOS/Android
      const defaultCalendar = (calendars || []).find((c: any) => c.isPrimary) || calendars[0];
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
    } catch {
      return null;
    }
  },
};
