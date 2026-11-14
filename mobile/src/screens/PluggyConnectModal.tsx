import React, { useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../theme/motion';
import { api } from '../services/api';
import { dataSync } from '../services/dataSync';
import type { FinanceConnection } from '../types/finance';
import { useByokSetup } from '../hooks/useByokSetup';
import { authenticate } from '../services/pluggyService';
import { syncPluggyItem } from '../services/pluggySync';
import * as byokStore from '../services/byokStore';
import { ByokTutorialCards } from '../components/finance/byok/ByokTutorialCards';
import { ByokStepper } from '../components/finance/byok/ByokStepper';
import { ByokShortcut } from '../components/finance/byok/ByokShortcut';
import { ByokSyncProgress } from '../components/finance/byok/ByokSyncProgress';
import { PluggyDashboardWebView } from '../components/finance/byok/PluggyDashboardWebView';
import { PluggyPortalWebView } from '../components/finance/byok/PluggyPortalWebView';
import { resolveModalBottomInset, resolveModalTopInset } from '../utils/safeArea';

interface PluggyConnectModalProps {
  visible: boolean;
  onClose: () => void;
  onConnectionSuccess?: () => void;
}

/**
 * Tela cheia `#s-fon` do fluxo BYOK Pluggy (Plano 26 v2.0):
 * tutorial → stepper com WebView de captura → progresso em 6 etapas → atalho pós-configuração.
 */
export const PluggyConnectModal: React.FC<PluggyConnectModalProps> = ({ visible, onClose, onConnectionSuccess }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [connections, setConnections] = useState<FinanceConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.finance.getConnections();
      setConnections(Array.isArray(data) ? data : []);
    } catch {
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void loadConnections();
  }, [visible, loadConnections]);

  const handleSynced = useCallback(() => {
    hapticFeedback.selection();
    dataSync.notify('refresh_finance');
    void loadConnections();
    onConnectionSuccess?.();
  }, [loadConnections, onConnectionSuccess]);

  const setup = useByokSetup({ visible, isDark, onSynced: handleSynced });

  const handleSyncConnection = async (conn: FinanceConnection) => {
    setSyncingId(conn.id);
    hapticFeedback.light();
    try {
      const keys = await byokStore.getKeys();
      if (!keys) throw new Error('Chaves não configuradas. Refaça o cadastro das chaves da Pluggy.');
      const apiKey = await authenticate(keys.clientId, keys.clientSecret);
      const res = await syncPluggyItem(apiKey, conn.pluggy_item_id);
      dataSync.notify('refresh_finance');
      await loadConnections();
      Alert.alert(
        'Sincronização concluída',
        `${res.accountsCount} contas e ${res.transactionsCount} transações de "${res.institutionName || conn.institution_name}".`,
      );
    } catch (err) {
      Alert.alert('Erro na sincronização', err instanceof Error ? err.message : 'Falha ao sincronizar com a Pluggy.');
    } finally {
      setSyncingId(null);
    }
  };

  const handleDeleteConnection = (conn: FinanceConnection) => {
    Alert.alert('Desconectar banco', `Deseja remover a conexão com "${conn.institution_name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desconectar',
        style: 'destructive',
        onPress: async () => {
          try {
            hapticFeedback.medium();
            await api.finance.deleteConnection(conn.id);
            dataSync.notify('refresh_finance');
            void loadConnections();
          } catch (err) {
            Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao desconectar.');
          }
        },
      },
    ]);
  };

  const inSyncScreen = setup.syncPhase !== 'idle';
  const contextLabel =
    setup.step === 'tutorial'
      ? 'Como funciona'
      : inSyncScreen
        ? setup.syncPhase === 'done'
          ? 'Conectar bancos'
          : 'Sincronizando'
        : setup.shortcut
          ? 'Conectar bancos'
          : 'Configurar Open Finance';

  const showConnectionsSection =
    setup.ready && setup.step !== 'tutorial' && !inSyncScreen && (setup.shortcut || connections.length > 0);

  const handleConfirmResetAll = () => {
    Alert.alert(
      'Começar do zero',
      'Apaga Client ID, Client Secret, backup cifrado e os cookies/sessão do navegador interno.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar e recomeçar', style: 'destructive', onPress: () => void setup.resetFromScratch() },
      ],
    );
  };

  const renderFlow = () => {
    if (!setup.ready) return <ActivityIndicator size="small" color={colors.ink} style={{ marginVertical: 32 }} />;
    if (setup.syncPhase !== 'idle') {
      return (
        <ByokSyncProgress
          phase={setup.syncPhase}
          completedCount={setup.syncCompletedCount}
          banks={setup.syncedBanks}
          error={setup.error}
          onRetrySync={setup.syncNow}
          onBack={setup.resetSyncView}
          onFinish={onClose}
        />
      );
    }
    if (setup.step === 'tutorial') return <ByokTutorialCards onDone={setup.finishTutorial} />;

    return (
      <>
        {setup.shortcut ? (
          <ByokShortcut setup={setup} />
        ) : (
          <>
            <ByokStepper setup={setup} />
            {setup.validated && (
              <TouchableOpacity onPress={setup.changeKeys} style={styles.linkBtn} accessibilityRole="button">
                <Text style={[styles.linkBtnText, { color: colors.muted }]}>Trocar chaves</Text>
              </TouchableOpacity>
            )}
          </>
        )}
        <TouchableOpacity onPress={handleConfirmResetAll} style={styles.linkBtn} accessibilityRole="button">
          <Text style={[styles.linkBtnText, { color: colors.red }]}>Apagar chaves e dados de navegação</Text>
        </TouchableOpacity>
      </>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <View
        style={[
          styles.screen,
          {
            backgroundColor: colors.bg,
            paddingTop: resolveModalTopInset(insets.top, 8),
            paddingBottom: resolveModalBottomInset(insets.bottom),
          },
        ]}
      >
        <View style={styles.ftop}>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeCircle, { borderColor: colors.line, backgroundColor: colors.bg }]}
            accessibilityRole="button"
            accessibilityLabel="Fechar"
          >
            <MaterialIcons name="close" size={20} color={colors.ink} />
          </TouchableOpacity>
          <Text style={[styles.contextLabel, { color: colors.muted }]}>{contextLabel}</Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {renderFlow()}

          {showConnectionsSection && (
            <View style={styles.connSection}>
              <Text style={[styles.section, { color: colors.muted }]}>INSTITUIÇÕES CONECTADAS</Text>
              {loading ? (
                <ActivityIndicator size="small" color={colors.ink} style={{ marginTop: 12 }} />
              ) : connections.length === 0 ? (
                <Text style={[styles.empty, { color: colors.muted }]}>Nenhum banco conectado ainda.</Text>
              ) : (
                connections.map((item) => {
                  const ok = item.status === 'UPDATED';
                  return (
                    <View key={item.id} style={[styles.connCard, { backgroundColor: colors.bg, borderColor: colors.line }]}>
                      <MaterialIcons name="account-balance" size={20} color={colors.ink} style={{ marginRight: 12 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.connName, { color: colors.ink }]}>
                          {item.institution_name || 'Meu Pluggy'}
                        </Text>
                        <Text style={[styles.connStatus, { color: ok ? colors.acc : colors.red }]}>
                          {ok ? 'Sincronizado' : 'Atenção necessária'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleSyncConnection(item)}
                        disabled={syncingId === item.id}
                        style={styles.iconBtn}
                        accessibilityLabel="Sincronizar banco"
                      >
                        {syncingId === item.id ? (
                          <ActivityIndicator size="small" color={colors.ink} />
                        ) : (
                          <MaterialIcons name="sync" size={22} color={colors.ink} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteConnection(item)}
                        style={styles.iconBtn}
                        accessibilityLabel="Desconectar banco"
                      >
                        <MaterialIcons name="delete-outline" size={22} color={colors.red} />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>

        <PluggyDashboardWebView
          visible={setup.webViewOpen}
          sessionKey={setup.webSessionKey}
          clientId={setup.clientId}
          clientSecret={setup.clientSecret}
          validating={setup.busy && setup.authStatus === 'validating'}
          captureError={setup.authStatus === 'error' || setup.authStatus === 'offline' ? setup.error : ''}
          onCapture={setup.handleWebViewCapture}
          onClearDraft={setup.clearDraftKeys}
          onConfirmKeys={() => void setup.confirmWebViewKeys()}
          onClose={setup.closeDashboard}
        />

        <PluggyPortalWebView
          visible={setup.portalMode !== null}
          mode={setup.portalMode ?? 'meu_pluggy'}
          url={setup.portalUrl}
          sessionKey={setup.webSessionKey}
          onClose={setup.closePortal}
          onFinishMeuPluggy={setup.finishMeuPluggyPortal}
          onConnectItemCaptured={(itemId) => void setup.completeConnectSync(itemId)}
          onFallbackConnectExternal={() => void setup.fallbackConnectExternal()}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 22 },
  ftop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  closeCircle: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  contextLabel: { fontSize: 12.5, fontWeight: '500' },
  scrollContent: { flexGrow: 1, paddingBottom: 28 },
  linkBtn: { minHeight: 40, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  linkBtnText: { fontSize: 14, fontWeight: '600' },
  connSection: { marginTop: 22 },
  section: { fontSize: 11.5, fontWeight: '600', letterSpacing: 0.7, marginBottom: 10 },
  empty: { fontSize: 13 },
  connCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1, marginBottom: 8 },
  connName: { fontSize: 14.5, fontWeight: '600' },
  connStatus: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
