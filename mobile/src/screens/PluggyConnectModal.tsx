import React, { useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ProtoUiIcon } from '../icons/ProtoUiIcons';
import { BrandLogo } from '../icons/IconRegistry';
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
      const res = await syncPluggyItem(apiKey, conn.pluggy_item_id, undefined, {
        mode: 'manual',
        connectionId: conn.id,
        lastSyncAt: conn.last_sync_at,
        lastBankRefreshAt: conn.last_bank_refresh_at,
        onRefreshApiKey: () => authenticate(keys.clientId, keys.clientSecret),
      });
      dataSync.notify('refresh_finance');
      await loadConnections();
      if (res.needsReconnect) {
        Alert.alert(
          'Reconexão necessária',
          `O banco "${res.institutionName || conn.institution_name}" precisa de nova autorização no Pluggy Connect.`,
          [
            { text: 'Depois', style: 'cancel' },
            { text: 'Reconectar', onPress: () => void setup.openReconnectExternal(conn.pluggy_item_id) },
          ],
        );
        return;
      }
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
      'Apaga Client ID, Client Secret e o backup cifrado armazenado no servidor.',
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
          connectionItemId={setup.connectionItemId}
          limitSuggestions={setup.limitSuggestions}
          onActivateSuggestion={setup.activateLimitSuggestion}
          onOpenCustomLimits={onClose}
          onUpdateItemId={setup.updateConnectionItemId}
          onPasteItemId={setup.pasteConnectionItemId}
          onSyncWithItemId={setup.completeConnectSync}
          onRetrySync={setup.openConnectExternal}
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
            <ProtoUiIcon name="close" size={20} color={colors.ink} />
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
                      <View style={{ marginRight: 12 }}>
                        {['Nubank', 'Itaú', 'Inter', 'Banco do Brasil', 'Bradesco', 'Santander', 'C6 Bank', 'Caixa'].includes(item.institution_name || '') ? (
                          <BrandLogo group="bank" id={item.institution_name!} size={22} color={colors.ink} />
                        ) : (
                          <ProtoUiIcon name="account-balance" size={20} color={colors.ink} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.connName, { color: colors.ink }]}>
                          {item.institution_name || 'Meu Pluggy'}
                        </Text>
                        <Text style={[styles.connStatus, { color: ok ? colors.acc : colors.red }]}>
                          {ok ? 'Sincronizado' : 'Atenção necessária'}
                        </Text>
                      </View>
                      {!ok && (
                        <TouchableOpacity
                          onPress={() => void setup.openReconnectExternal(item.pluggy_item_id)}
                          style={[styles.reconnectBtn, { borderColor: colors.red }]}
                          accessibilityLabel="Reconectar banco"
                        >
                          <Text style={[styles.reconnectText, { color: colors.red }]}>Reconectar</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => handleSyncConnection(item)}
                        disabled={syncingId === item.id}
                        style={styles.iconBtn}
                        accessibilityLabel="Sincronizar banco"
                      >
                        {syncingId === item.id ? (
                          <ActivityIndicator size="small" color={colors.ink} />
                        ) : (
                          <ProtoUiIcon name="sync" size={22} color={colors.ink} />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteConnection(item)}
                        style={styles.iconBtn}
                        accessibilityLabel="Desconectar banco"
                      >
                        <ProtoUiIcon name="delete-outline" size={22} color={colors.red} />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
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
  reconnectBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, marginRight: 4 },
  reconnectText: { fontSize: 12, fontWeight: '700' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
