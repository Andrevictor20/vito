import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useCalendarSync } from '../../hooks/useCalendarSync';

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
    connectAppleCalDAV,
    connectNativeApple,
    syncProvider,
    disconnectProvider,
    getIntegration,
  } = useCalendarSync();

  // Estados de formulário CalDAV
  const [showAppleForm, setShowAppleForm] = useState(false);
  const [appleId, setAppleId] = useState('');
  const [appSpecificPassword, setAppSpecificPassword] = useState('');
  const [disconnectingProvider, setDisconnectingProvider] = useState<string | null>(null);

  const googleInteg = getIntegration('google');
  const appleCalDAVInteg = getIntegration('apple_caldav');
  const appleNativeInteg = getIntegration('apple_native');

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

  const handleSyncAppleCalDAV = async () => {
    try {
      await syncProvider('apple_caldav');
      Alert.alert('Sucesso', 'Eventos do iCloud sincronizados com sucesso!');
    } catch (err: any) {
      Alert.alert('Erro ao Sincronizar', err?.message || 'Falha ao sincronizar eventos do iCloud.');
    }
  };

  const handleConnectAppleCalDAV = async () => {
    if (!appleId.trim() || !appSpecificPassword.trim()) {
      Alert.alert('Atenção', 'Preencha o Apple ID e a Senha de App Específica.');
      return;
    }
    try {
      await connectAppleCalDAV(appleId.trim(), appSpecificPassword.trim());
      setShowAppleForm(false);
      setAppleId('');
      setAppSpecificPassword('');
      Alert.alert('Sucesso', 'iCloud CalDAV conectado e sincronização ativada!');
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Falha ao conectar ao CalDAV da Apple');
    }
  };

  const handleToggleNativeApple = async () => {
    if (appleNativeInteg) {
      await disconnectProvider('apple_native');
    } else {
      try {
        await connectNativeApple();
        Alert.alert('Sucesso', 'Calendário Nativo conectado com sucesso!');
      } catch (err: any) {
        Alert.alert('Atenção', err.message || 'Não foi possível conectar ao calendário nativo');
      }
    }
  };

  const formatLastSync = (dateStr?: string) => {
    if (!dateStr) return 'Nunca sincronizado';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' de ' + date.toLocaleDateString();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: colors.surface, borderColor: colors.outlineVariant },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.outlineVariant }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconBox, { backgroundColor: colors.surfaceContainerHigh }]}>
                <MaterialIcons name="sync" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.onSurface }]}>
                  Sincronização de Calendários
                </Text>
                <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
                  Google Calendar & Apple iCloud
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceContainerHigh }]}
              accessibilityLabel="Fechar modal"
            >
              <MaterialIcons name="close" size={20} color={colors.onSurface} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Banner Informativo */}
            <View style={[styles.infoBanner, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
              <MaterialIcons name="security" size={18} color={colors.primary} />
              <Text style={[styles.infoBannerText, { color: colors.onSurfaceVariant }]}>
                Sincronização bidirecional com supressão de eco e proteção de dados em repouso com AES-256.
              </Text>
            </View>

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
                    <MaterialIcons name="event" size={20} color="#EA4335" />
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
                          <MaterialIcons name="refresh" size={16} color={isDark ? colors.onSurface : '#FFFFFF'} />
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
                        <MaterialIcons name="sync" size={16} color={isDark ? colors.onSurface : '#FFFFFF'} />
                        <Text style={[styles.connectBtnText, { color: isDark ? colors.onSurface : '#FFFFFF' }]}>
                          Conectar Conta Google
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* CARD 2: APPLE CALENDAR (iCloud CalDAV & Nativo) */}
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <View style={[styles.providerIconBox, { backgroundColor: isDark ? '#FFFFFF15' : '#00000010' }]}>
                    <MaterialIcons name="apple" size={22} color={colors.onSurface} />
                  </View>
                  <View>
                    <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
                      Apple Calendar
                    </Text>
                    <Text style={[styles.cardSub, { color: colors.onSurfaceVariant }]}>
                      {appleCalDAVInteg
                        ? `iCloud CalDAV: ${appleCalDAVInteg.account_email}`
                        : appleNativeInteg
                        ? 'Calendário Nativo iOS Ativo'
                        : 'iCloud 24/7 ou Local do Dispositivo'}
                    </Text>
                  </View>
                </View>

                {(appleCalDAVInteg || appleNativeInteg) && (
                  <View style={[styles.badgeActive, { backgroundColor: '#10B981' + '20' }]}>
                    <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                    <Text style={[styles.badgeText, { color: '#10B981' }]}>Ativo</Text>
                  </View>
                )}
              </View>

              {/* Opção Nativa iOS */}
              <TouchableOpacity
                style={[styles.optionRow, { borderTopColor: colors.outlineVariant }]}
                onPress={handleToggleNativeApple}
                activeOpacity={0.7}
              >
                <View style={styles.optionLeft}>
                  <MaterialIcons name="phone-iphone" size={18} color={colors.primary} />
                  <View style={styles.optionTexts}>
                    <Text style={[styles.optionTitle, { color: colors.onSurface }]}>
                      Sync Nativo do Dispositivo
                    </Text>
                    <Text style={[styles.optionDesc, { color: colors.onSurfaceVariant }]}>
                      Sincroniza sem digitar senhas usando o EventKit local
                    </Text>
                  </View>
                </View>
                <MaterialIcons
                  name={appleNativeInteg ? 'check-circle' : 'radio-button-unchecked'}
                  size={20}
                  color={appleNativeInteg ? '#10B981' : colors.outline}
                />
              </TouchableOpacity>

              {/* Opção CalDAV Headless 24/7 */}
              {appleCalDAVInteg ? (
                <View style={[styles.connectedActions, { borderTopWidth: 1, borderTopColor: colors.outlineVariant }]}>
                  <Text style={[styles.syncTimeText, { color: colors.onSurfaceVariant }]}>
                    Última sincronização CalDAV: {formatLastSync(appleCalDAVInteg.last_synced_at)}
                  </Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[
                        styles.primaryActionBtn,
                        {
                          backgroundColor: isDark ? colors.surfaceContainerHighest : colors.primary,
                          borderWidth: isDark ? 1 : 0,
                          borderColor: colors.outlineVariant,
                        },
                      ]}
                      onPress={handleSyncAppleCalDAV}
                      disabled={isSyncing}
                      activeOpacity={0.8}
                    >
                      {isSyncing ? (
                        <ActivityIndicator size="small" color={isDark ? colors.onSurface : '#FFFFFF'} />
                      ) : (
                        <>
                          <MaterialIcons name="refresh" size={16} color={isDark ? colors.onSurface : '#FFFFFF'} />
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
                          opacity: isSyncing || disconnectingProvider === 'apple_caldav' ? 0.6 : 1,
                        },
                      ]}
                      onPress={() => handleDisconnect('apple_caldav', 'iCloud CalDAV')}
                      disabled={isSyncing || disconnectingProvider === 'apple_caldav'}
                    >
                      {disconnectingProvider === 'apple_caldav' ? (
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
                <View style={[styles.optionContainer, { borderTopWidth: 1, borderTopColor: colors.outlineVariant }]}>
                  {!showAppleForm ? (
                    <TouchableOpacity
                      style={[styles.connectBtnSecondary, { borderColor: colors.outlineVariant }]}
                      onPress={() => setShowAppleForm(true)}
                    >
                      <MaterialIcons name="cloud" size={16} color={colors.onSurface} />
                      <Text style={[styles.connectBtnSecondaryText, { color: colors.onSurface }]}>
                        Conectar iCloud CalDAV 24/7
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.formContainer}>
                      <Text style={[styles.formHelper, { color: colors.onSurfaceVariant }]}>
                        Utilize sua Senha de App Específica gerada em appleid.apple.com
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.surfaceContainerHigh,
                            color: colors.onSurface,
                            borderColor: colors.outlineVariant,
                          },
                        ]}
                        placeholder="Apple ID (ex: seu-nome@icloud.com)"
                        placeholderTextColor={colors.onSurfaceVariant}
                        value={appleId}
                        onChangeText={setAppleId}
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.surfaceContainerHigh,
                            color: colors.onSurface,
                            borderColor: colors.outlineVariant,
                          },
                        ]}
                        placeholder="Senha de App (xxxx-xxxx-xxxx-xxxx)"
                        placeholderTextColor={colors.onSurfaceVariant}
                        value={appSpecificPassword}
                        onChangeText={setAppSpecificPassword}
                        secureTextEntry
                        autoCapitalize="none"
                      />
                      <View style={styles.formButtonRow}>
                        <TouchableOpacity
                          style={[
                            styles.confirmBtn,
                            {
                              backgroundColor: isDark ? colors.surfaceContainerHighest : colors.primary,
                              borderWidth: isDark ? 1 : 0,
                              borderColor: colors.outlineVariant,
                            },
                          ]}
                          onPress={handleConnectAppleCalDAV}
                          disabled={isLoading}
                          activeOpacity={0.8}
                        >
                          {isLoading ? (
                            <ActivityIndicator size="small" color={isDark ? colors.onSurface : '#FFFFFF'} />
                          ) : (
                            <Text style={[styles.confirmBtnText, { color: isDark ? colors.onSurface : '#FFFFFF' }]}>
                              Salvar CalDAV
                            </Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.cancelBtn, { borderColor: colors.outlineVariant }]}
                          onPress={() => setShowAppleForm(false)}
                        >
                          <Text style={[styles.cancelBtnText, { color: colors.onSurfaceVariant }]}>
                            Cancelar
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  connectBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  connectBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  optionTexts: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  optionDesc: {
    fontSize: 11,
    marginTop: 1,
  },
  optionContainer: {
    paddingTop: 12,
  },
  formContainer: {
    gap: 10,
  },
  formHelper: {
    fontSize: 11,
  },
  input: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    borderWidth: 1,
  },
  formButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  cancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
  },
});
