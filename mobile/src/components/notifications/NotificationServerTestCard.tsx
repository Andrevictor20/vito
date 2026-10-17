import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { notificationService } from '../../services/notificationService';

interface NotificationServerTestCardProps {
  permissionGranted: boolean;
  onPermissionRequest: () => void;
}

export const NotificationServerTestCard: React.FC<NotificationServerTestCardProps> = ({
  permissionGranted,
  onPermissionRequest,
}) => {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [serverStatus, setServerStatus] = useState<{ registered: boolean; device_count: number } | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await api.getNotificationStatus();
      setServerStatus(res);
    } catch {
      setServerStatus(null);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [permissionGranted]);

  const handleSyncDevice = async () => {
    if (!permissionGranted) {
      onPermissionRequest();
      return;
    }
    setLoading(true);
    try {
      const res = await notificationService.syncPushTokenWithBackend();
      if (res.success) {
        await fetchStatus();
        Alert.alert('Dispositivo Sincronizado', 'Seu aparelho foi registrado com sucesso no servidor do Vito.');
      } else {
        Alert.alert('Falha na Sincronização', res.error || 'Não foi possível registrar o aparelho.');
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Falha na conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestPush = async () => {
    if (!permissionGranted) {
      Alert.alert('Permissão Necessária', 'Autorize as notificações antes de realizar o teste.');
      return;
    }
    setTesting(true);
    try {
      // Auto-cura preventiva: se status ainda não estiver registrado, tenta sincronizar token primeiro
      if (!serverStatus?.registered) {
        await notificationService.syncPushTokenWithBackend().catch(() => {});
      }
      const res = await api.testPushNotification('default');
      await fetchStatus();
      if (res.dispatched > 0) {
        Alert.alert(
          'Notificação Enviada',
          'O servidor Vito disparou uma notificação push para este aparelho. Verifique o topo da tela ou a barra de notificações.'
        );
      } else {
        Alert.alert(
          'Aparelho Não Registrado',
          'O servidor não encontrou nenhum token para a sua conta. Toque em "Sincronizar Aparelho" para conectar.'
        );
      }
    } catch (e: any) {
      Alert.alert('Falha no Teste', e?.message || 'Erro ao comunicar com o servidor.');
    } finally {
      setTesting(false);
    }
  };

  const isConnected = serverStatus?.registered && serverStatus.device_count > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <MaterialIcons
            name={isConnected ? 'cloud-done' : 'cloud-off'}
            size={20}
            color={isConnected ? '#10B981' : '#F59E0B'}
          />
          <View style={styles.titleBox}>
            <Text style={[styles.title, { color: colors.onSurface }]}>Conexão Push com Servidor</Text>
            <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
              {isConnected
                ? `Ativo: ${serverStatus?.device_count} aparelho(s) conectado(s)`
                : 'Pendente: Aparelho ainda não vinculado ao servidor'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.btnSecondary, { borderColor: colors.outlineVariant, backgroundColor: colors.surface }]}
          onPress={handleSyncDevice}
          disabled={loading}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <MaterialIcons name="sync" size={16} color={colors.primary} />
              <Text style={[styles.btnTextSecondary, { color: colors.onSurface }]}>Sincronizar</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btnPrimary, { backgroundColor: colors.primary }]}
          onPress={handleTestPush}
          disabled={testing}
          activeOpacity={0.8}
        >
          {testing ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <>
              <MaterialIcons name="send" size={16} color={colors.onPrimary} />
              <Text style={[styles.btnTextPrimary, { color: colors.onPrimary }]}>Testar Push</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  titleBox: {
    flex: 1,
  },
  title: {
    fontSize: tokens.typography.size.sm,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: tokens.typography.size.xs,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnSecondary: {
    flex: 1,
    height: 40,
    borderRadius: MD3Shapes.small,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnPrimary: {
    flex: 1,
    height: 40,
    borderRadius: MD3Shapes.small,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnTextSecondary: {
    fontSize: tokens.typography.size.xs,
    fontWeight: '600',
  },
  btnTextPrimary: {
    fontSize: tokens.typography.size.xs,
    fontWeight: '600',
  },
});
