import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { ProtoUiIcon } from '../../../icons/ProtoUiIcons';
import { useTheme } from '../../../context/ThemeContext';
import { VitoSheet } from '../../../components/ui/VitoSheet';
import { useCalendarSync } from '../../calendar/hooks/useCalendarSync';

interface CalendarSyncSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}

export const CalendarSyncSettingsModal: React.FC<CalendarSyncSettingsModalProps> = ({
  visible,
  onClose,
  onDataChanged,
}) => {
  const { colors, isDark } = useTheme();
  const {
    isLoading,
    isSyncing,
    connectGoogleOAuth,
    syncProvider,
    disconnectProvider,
    getIntegration,
  } = useCalendarSync();

  const [disconnectingProvider, setDisconnectingProvider] = useState<string | null>(null);

  const googleInteg = getIntegration('google');

  const handleDisconnect = async (provider: string, label: string) => {
    try {
      setDisconnectingProvider(provider);
      await disconnectProvider(provider);
      onDataChanged?.();
      Alert.alert('Sucesso', `${label} desconectado com sucesso.`);
    } catch (err: any) {
      Alert.alert('Erro ao Desconectar', err?.message || `Falha ao desconectar ${label}.`);
    } finally {
      setDisconnectingProvider(null);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const res = await connectGoogleOAuth();
      onDataChanged?.();
      Alert.alert('Sucesso', `Google Calendar (${res.email}) conectado com sincronização ativada!`);
    } catch (err: any) {
      if (err?.message?.includes('cancelad')) {
        return;
      }
      Alert.alert('Erro', err.message || 'Falha ao conectar com o Google Calendar');
    }
  };

  const handleSyncGoogle = async () => {
    try {
      await syncProvider('google');
      onDataChanged?.();
      Alert.alert('Sucesso', 'Eventos do Google Calendar sincronizados com sucesso!');
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('403') || msg.includes('insufficient') || msg.includes('permission')) {
        Alert.alert(
          'Permissão Necessária',
          'Sua conta precisa de autorização para ler o Google Calendar. Por favor, clique em "Desconectar" e reconecte sua conta Google para autorizar o acesso aos eventos.'
        );
      } else {
        Alert.alert('Erro ao Sincronizar', msg || 'Falha ao sincronizar eventos do Google Calendar.');
      }
    }
  };

  const formatLastSync = (dateStr?: string) => {
    if (!dateStr) return 'Nunca sincronizado';
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <VitoSheet
      visible={visible}
      onClose={onClose}
      title="Sincronização de Calendários"
      subtitle="Conecte sua conta Google Calendar"
    >
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

            {/* CARD 1: GOOGLE CALENDAR */}
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.providerIconBox, { backgroundColor: '#EA4335' + '1A' }]}>
                    <ProtoUiIcon name="event" size={20} color="#EA4335" />
                  </View>
                  <View>
                    <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
                      Google Calendar
                    </Text>
                    <Text style={[styles.cardSub, { color: colors.onSurfaceVariant }]}>
                      {googleInteg
                        ? `Conectado: ${googleInteg.account_email}`
                        : 'Agenda Google Workspace ou Pessoal'}
                    </Text>
                  </View>
                </View>

                {googleInteg && (
                  <View style={[styles.badgeActive, { backgroundColor: '#10B981' + '20' }]}>
                    <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                    <Text style={[styles.badgeText, { color: '#10B981' }]}>Ativo</Text>
                  </View>
                )}
              </View>

              {googleInteg ? (
                <View style={styles.connectedActions}>
                  <Text style={[styles.syncTimeText, { color: colors.onSurfaceVariant }]}>
                    Última sincronização: {formatLastSync(googleInteg.last_synced_at)}
                  </Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[
                        styles.primaryActionBtn,
                        {
                          backgroundColor: isDark ? colors.surfaceContainerHighest : colors.primary,
                          borderWidth: isDark ? 1 : 0,
                          borderColor: colors.outlineVariant,
                          opacity: isSyncing || disconnectingProvider === 'google' ? 0.6 : 1,
                        },
                      ]}
                      onPress={handleSyncGoogle}
                      disabled={isSyncing || disconnectingProvider === 'google'}
                      activeOpacity={0.8}
                    >
                      {isSyncing ? (
                        <ActivityIndicator size="small" color={isDark ? colors.onSurface : '#FFFFFF'} />
                      ) : (
                        <>
                          <ProtoUiIcon name="refresh" size={16} color={isDark ? colors.onSurface : '#FFFFFF'} />
                          <Text style={[styles.primaryActionText, { color: isDark ? colors.onSurface : '#FFFFFF' }]}>
                            Sincronizar
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.secondaryActionBtn,
                        {
                          borderColor: colors.outlineVariant,
                          opacity: isSyncing || disconnectingProvider === 'google' ? 0.6 : 1,
                        },
                      ]}
                      onPress={() => handleDisconnect('google', 'Google Calendar')}
                      disabled={isSyncing || disconnectingProvider === 'google'}
                    >
                      {disconnectingProvider === 'google' ? (
                        <ActivityIndicator size="small" color={colors.error} />
                      ) : (
                        <Text style={[styles.secondaryActionText, { color: colors.error }]}>
                          Desconectar
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.disconnectedActions}>
                  <TouchableOpacity
                    style={[
                      styles.connectBtn,
                      {
                        backgroundColor: isDark ? colors.surfaceContainerHighest : colors.primary,
                        borderWidth: isDark ? 1 : 0,
                        borderColor: colors.outlineVariant,
                      },
                    ]}
                    onPress={handleConnectGoogle}
                    disabled={isLoading}
                    activeOpacity={0.8}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={isDark ? colors.onSurface : '#FFFFFF'} />
                    ) : (
                      <>
                        <ProtoUiIcon name="sync" size={16} color={isDark ? colors.onSurface : '#FFFFFF'} />
                        <Text style={[styles.connectBtnText, { color: isDark ? colors.onSurface : '#FFFFFF' }]}>
                          Conectar Conta Google
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

          </ScrollView>
    </VitoSheet>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  providerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 12,
    marginTop: 2,
  },
  badgeActive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  connectedActions: {
    gap: 10,
    paddingTop: 8,
  },
  syncTimeText: {
    fontSize: 11,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryActionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  disconnectedActions: {
    paddingTop: 4,
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  connectBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});

