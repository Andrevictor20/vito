import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import type * as Notifications from 'expo-notifications';
import { notificationService } from '../services/notificationService';
import { NotificationPriority, NotificationSettings, ScheduleNotificationParams } from '../types';

export function useNotifications() {
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    defaultPriority: 'default',
    reminderMinutesBefore: 10,
  });
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
  const [canAskAgain, setCanAskAgain] = useState<boolean>(true);
  const [lastNotification, setLastNotification] = useState<Notifications.Notification | null>(null);
  const [lastResponse, setLastResponse] = useState<Notifications.NotificationResponse | null>(null);

  // Carrega configurações e inicializa canais M3
  useEffect(() => {
    let isMounted = true;

    async function checkStatus() {
      const perm = await notificationService.checkPermissionStatus();
      if (isMounted) {
        setPermissionGranted(perm.granted);
        setCanAskAgain(perm.canAskAgain);
      }
    }

    async function setup() {
      await notificationService.init();
      const saved = await notificationService.getSettings();
      if (isMounted) {
        setSettings(saved);
      }
      await checkStatus();
    }

    setup();

    // Reavalia permissão ao retornar das Configurações do Android/iOS
    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        checkStatus();
      }
    });

    // Listeners para recebimento e resposta (toque)
    const receivedSub = notificationService.addReceivedListener((notif) => {
      if (isMounted) setLastNotification(notif);
    });

    const responseSub = notificationService.addResponseListener((resp) => {
      if (isMounted) setLastResponse(resp);
    });

    return () => {
      isMounted = false;
      appStateSub.remove();
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  const requestPermissions = useCallback(async (userInitiated: boolean = false) => {
    const res = await notificationService.requestPermissions(userInitiated);
    setPermissionGranted(res.granted);
    setCanAskAgain(res.canAskAgain);
    if (res.granted) {
      const updated = await notificationService.getSettings();
      setSettings(updated);
    }
    return res;
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<NotificationSettings>) => {
    const updated = await notificationService.saveSettings(newSettings);
    setSettings(updated);
    return updated;
  }, []);

  const scheduleReminder = useCallback(async (params: ScheduleNotificationParams) => {
    return notificationService.scheduleEventReminder(params);
  }, []);

  return {
    settings,
    permissionGranted,
    canAskAgain,
    lastNotification,
    lastResponse,
    requestPermissions,
    updateSettings,
    scheduleReminder,
  };
}
