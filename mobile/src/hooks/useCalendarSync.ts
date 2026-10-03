import { useState, useEffect, useCallback } from 'react';
import { calendarSyncService, CalendarIntegration } from '../services/calendarSyncService';
import { nativeCalendarService } from '../services/nativeCalendarService';

export function useCalendarSync() {
  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadIntegrations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await calendarSyncService.listIntegrations();
      setIntegrations(data || []);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar integrações de calendário');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  const connectGoogle = async (email: string, credentialsJson: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await calendarSyncService.connectIntegration({
        provider: 'google',
        account_email: email,
        credentials: credentialsJson,
        calendar_id: 'primary',
        calendar_name: 'Google Calendar Principal',
      });
      await loadIntegrations();
      return result;
    } catch (err: any) {
      setError(err?.message || 'Falha ao conectar com o Google Calendar');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const connectAppleCalDAV = async (appleId: string, appSpecificPass: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const creds = JSON.stringify({ username: appleId, password: appSpecificPass });
      const result = await calendarSyncService.connectIntegration({
        provider: 'apple_caldav',
        account_email: appleId,
        credentials: creds,
        calendar_id: 'primary',
        calendar_name: 'Apple iCloud Calendar',
      });
      await loadIntegrations();
      return result;
    } catch (err: any) {
      setError(err?.message || 'Falha ao conectar com o iCloud CalDAV');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const connectNativeApple = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const granted = await nativeCalendarService.requestPermissions();
      if (!granted) {
        throw new Error('Permissão para acessar o calendário do dispositivo foi negada');
      }

      const vitoCalId = await nativeCalendarService.getOrCreateVitoCalendar();
      const result = await calendarSyncService.connectIntegration({
        provider: 'apple_native',
        account_email: 'local_device@apple.ios',
        credentials: 'native_permission_granted',
        calendar_id: vitoCalId || 'native_primary',
        calendar_name: 'Calendário Nativo do Sistema',
      });
      await loadIntegrations();
      return result;
    } catch (err: any) {
      setError(err?.message || 'Falha ao configurar calendário nativo');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const syncProvider = async (provider: string) => {
    try {
      setIsSyncing(true);
      setError(null);
      await calendarSyncService.syncIntegration(provider);
      await loadIntegrations();
    } catch (err: any) {
      setError(err?.message || `Falha ao sincronizar com ${provider}`);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  const disconnectProvider = async (provider: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await calendarSyncService.disconnectIntegration(provider);
      await loadIntegrations();
    } catch (err: any) {
      setError(err?.message || `Falha ao desconectar ${provider}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const getIntegration = (provider: 'google' | 'apple_caldav' | 'apple_native') => {
    return integrations.find((i) => i.provider === provider);
  };

  return {
    integrations,
    isLoading,
    isSyncing,
    error,
    refresh: loadIntegrations,
    connectGoogle,
    connectAppleCalDAV,
    connectNativeApple,
    syncProvider,
    disconnectProvider,
    getIntegration,
  };
}
