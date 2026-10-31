import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [deviceCount, setDeviceCount] = useState(0);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.getNotificationStatus();
      setDeviceCount(res.device_count || 0);
    } catch (e) {
      console.error('[useNotifications] Falha ao buscar status:', e);
    }
  }, []);

  const testPush = useCallback(async () => {
    return api.testNotification('default', 'Teste Vito', 'Notificação de teste executivo');
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    unreadCount,
    setUnreadCount,
    deviceCount,
    refresh: fetchStatus,
    testPush,
  };
}
