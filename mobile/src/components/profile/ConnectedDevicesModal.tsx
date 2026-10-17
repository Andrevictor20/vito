import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { UserSession } from '../../types';
import { BottomSheetModal } from '../ui/BottomSheetModal';

interface ConnectedDevicesModalProps {
  visible: boolean;
  onClose: () => void;
  onSessionsChanged?: (count: number) => void;
}

const getDeviceIcon = (os?: string, deviceName?: string): keyof typeof MaterialIcons.glyphMap => {
  const lowerOs = (os || '').toLowerCase();
  const lowerName = (deviceName || '').toLowerCase();
  if (lowerOs.includes('android') || lowerName.includes('android')) return 'phone-android';
  if (lowerOs.includes('ios') || lowerName.includes('iphone') || lowerName.includes('ipad')) return 'phone-iphone';
  if (lowerOs.includes('mac') || lowerOs.includes('windows') || lowerOs.includes('linux')) return 'laptop';
  return 'devices';
};

const formatLastUsed = (iso?: string): string => {
  if (!iso) return 'Agora mesmo';
  try {
    const dt = new Date(iso);
    if (isNaN(dt.getTime())) return 'Recente';
    return dt.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Recente';
  }
};

export const ConnectedDevicesModal: React.FC<ConnectedDevicesModalProps> = ({
  visible,
  onClose,
  onSessionsChanged,
}) => {
  const { colors } = useTheme();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getSessions();
      const list = res?.sessions || [];
      setSessions(list);
      onSessionsChanged?.(list.length);
    } catch (err: any) {
      console.warn('[ConnectedDevicesModal] Falha ao listar sessões:', err);
    } finally {
      setLoading(false);
    }
  }, [onSessionsChanged]);

  useEffect(() => {
    if (visible) {
      loadSessions();
    }
  }, [visible, loadSessions]);

  const handleRevokeSession = (session: UserSession) => {
    Alert.alert(
      'Desconectar Dispositivo',
      `Deseja encerrar o acesso de "${session.device_name || 'Dispositivo'}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            setRevokingId(session.id);
            try {
              await api.revokeSession(session.id);
              await loadSessions();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível revogar a sessão.');
            } finally {
              setRevokingId(null);
            }
          },
        },
      ]
    );
  };

  const handleRevokeOthers = () => {
    Alert.alert(
      'Desconectar Outros Dispositivos',
      'Todos os outros aparelhos precisarão fazer login novamente. Este dispositivo continuará conectado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar Todos',
          style: 'destructive',
          onPress: async () => {
            setRevokingAll(true);
            try {
              await api.revokeOtherSessions();
              await loadSessions();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível desconectar os outros aparelhos.');
            } finally {
              setRevokingAll(false);
            }
          },
        },
      ]
    );
  };

  const otherSessionsCount = sessions.filter((s) => !s.is_current).length;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Dispositivos Conectados"
      subtitle="Gerencie suas sessões ativas e proteja sua conta"
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>
            Verificando sessões ativas...
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View
            style={[
              styles.infoBanner,
              { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
            ]}
          >
            <MaterialIcons name="verified-user" size={18} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.onSurfaceVariant }]}>
              Sessões protegidas por rotação automática de tokens (Access 15m + Refresh 30d).
            </Text>
          </View>

          {sessions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>
                Nenhuma sessão ativa encontrada.
              </Text>
            </View>
          ) : (
            sessions.map((session) => (
              <View
                key={session.id}
                style={[
                  styles.sessionCard,
                  {
                    backgroundColor: colors.surfaceContainer,
                    borderColor: session.is_current ? colors.primary : colors.outlineVariant,
                    borderWidth: session.is_current ? 1.5 : 1,
                  },
                ]}
              >
                <View style={styles.sessionLeft}>
                  <View
                    style={[
                      styles.iconBox,
                      {
                        backgroundColor: session.is_current
                          ? colors.primary + '18'
                          : colors.surfaceContainerHigh,
                      },
                    ]}
                  >
                    <MaterialIcons
                      name={getDeviceIcon(session.device_name, session.device_name)}
                      size={22}
                      color={session.is_current ? colors.primary : colors.onSurfaceVariant}
                    />
                  </View>
                  <View style={styles.sessionMeta}>
                    <View style={styles.titleRow}>
                      <Text style={[styles.deviceName, { color: colors.onSurface }]} numberOfLines={1}>
                        {session.device_name || 'Dispositivo Vito'}
                      </Text>
                      {session.is_current && (
                        <View style={[styles.currentBadge, { backgroundColor: colors.primary + '20' }]}>
                          <Text style={[styles.currentBadgeText, { color: colors.primary }]}>
                            Este Aparelho
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.subInfo, { color: colors.onSurfaceVariant }]}>
                      {session.ip_address ? `IP ${session.ip_address}` : 'Sessão autenticada'}
                    </Text>
                    <Text style={[styles.lastUsedText, { color: colors.textMuted }]}>
                      Último acesso: {formatLastUsed(session.last_used_at)}
                    </Text>
                  </View>
                </View>

                {!session.is_current && (
                  <TouchableOpacity
                    style={[styles.revokeButton, { borderColor: colors.danger + '50' }]}
                    onPress={() => handleRevokeSession(session)}
                    disabled={revokingId === session.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Desconectar ${session.device_name}`}
                  >
                    {revokingId === session.id ? (
                      <ActivityIndicator size="small" color={colors.danger} />
                    ) : (
                      <Text style={[styles.revokeButtonText, { color: colors.danger }]}>
                        Desconectar
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}

          {otherSessionsCount > 0 && (
            <TouchableOpacity
              style={[
                styles.revokeAllButton,
                { backgroundColor: colors.danger + '14', borderColor: colors.danger + '40' },
              ]}
              onPress={handleRevokeOthers}
              disabled={revokingAll}
              accessibilityRole="button"
              accessibilityLabel="Desconectar de todos os outros dispositivos"
            >
              {revokingAll ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <>
                  <MaterialIcons name="phonelink-erase" size={18} color={colors.danger} />
                  <Text style={[styles.revokeAllText, { color: colors.danger }]}>
                    Desconectar de todos os outros dispositivos ({otherSessionsCount})
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  loadingContainer: { padding: 40, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13 },
  scrollContent: { padding: 16, gap: 12, paddingBottom: 36 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: { fontSize: 12, lineHeight: 17, flex: 1 },
  emptyBox: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 13 },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    gap: 10,
  },
  sessionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconBox: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sessionMeta: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  deviceName: { fontSize: 14, fontWeight: '700' },
  currentBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  currentBadgeText: { fontSize: 10, fontWeight: '700' },
  subInfo: { fontSize: 12 },
  lastUsedText: { fontSize: 11 },
  revokeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  revokeButtonText: { fontSize: 12, fontWeight: '700' },
  revokeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
  },
  revokeAllText: { fontSize: 13, fontWeight: '700' },
});
