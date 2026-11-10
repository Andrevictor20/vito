import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../theme/motion';
import { api } from '../services/api';
import { dataSync } from '../services/dataSync';
import type { FinanceConnection } from '../types/finance';

interface PluggyConnectModalProps {
  visible: boolean;
  onClose: () => void;
  onConnectionSuccess?: () => void;
}

export const PluggyConnectModal: React.FC<PluggyConnectModalProps> = ({
  visible,
  onClose,
  onConnectionSuccess,
}) => {
  const { colors, isDark } = useTheme();
  const [connections, setConnections] = useState<FinanceConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);

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
    if (visible) {
      loadConnections();
    }
  }, [visible, loadConnections]);

  const handleOpenPluggyWidget = async () => {
    setConnecting(true);
    hapticFeedback.medium();
    try {
      let tokenRes;
      try {
        tokenRes = await api.finance.getConnectToken();
      } catch (err: any) {
        const errMsg = err?.message || '';
        if (errMsg.includes('PLUGGY_CLIENT_ID') || errMsg.includes('Open Finance') || errMsg.includes('credenciais')) {
          Alert.alert(
            'Configuração do Open Finance',
            'Para conectar contas bancárias reais via Pluggy, adicione as chaves no arquivo .env do servidor Vito:\n\nPLUGGY_CLIENT_ID=...\nPLUGGY_CLIENT_SECRET=...\n\n(Obtenha gratuitamente em dashboard.pluggy.ai)',
            [{ text: 'Entendi', style: 'default' }]
          );
          return;
        }
        if (
          errMsg.includes('autorização ausente') ||
          errMsg.includes('não autorizado') ||
          errMsg.includes('token inválido') ||
          errMsg.includes('expirado') ||
          errMsg.includes('sessão revogada') ||
          err?.status === 401
        ) {
          Alert.alert(
            'Sessão Expirada',
            'Sua sessão no Vito precisa ser renovada após o reinício do servidor. Por favor, feche e reabra o aplicativo (ou saia e entre novamente no Perfil) para conectar com segurança.',
            [{ text: 'Entendi', style: 'default' }]
          );
          return;
        }
        throw err;
      }

      const token = tokenRes?.connect_token;
      const apiKey = (tokenRes as any)?.api_key;
      if (!token) {
        throw new Error('Não foi possível obter o token de conexão do Open Finance.');
      }

      // Abre o widget oficial da Pluggy para escolha do banco do usuário (Nubank, Itaú, Inter, etc.)
      // Nota: o web app connect.pluggy.ai lê estritamente "connect_token" em snake_case dos query params.
      const widgetUrl =
        (tokenRes as any)?.widget_url ||
        `https://connect.pluggy.ai/?connect_token=${encodeURIComponent(token)}&connectToken=${encodeURIComponent(token)}&theme=${isDark ? 'dark' : 'light'}`;

      let authResult = null;
      if (WebBrowser?.openAuthSessionAsync) {
        authResult = await WebBrowser.openAuthSessionAsync(widgetUrl, 'vito://pluggy-success');
      } else {
        await Linking.openURL(widgetUrl);
      }

      let itemId = '';
      if (authResult && authResult.type === 'success' && authResult.url) {
        try {
          const match = authResult.url.match(/itemId=([^&]+)/);
          if (match && match[1]) itemId = decodeURIComponent(match[1]);
        } catch {}
      }

      if (!itemId) {
        itemId = `item_${Date.now()}`;
      }

      // Edge-Sync: Busca contas reais na Pluggy diretamente do aparelho do usuário (Zero IP Leak)
      let fetchedAccounts: any[] = [];
      if (apiKey && itemId && !itemId.startsWith('item_')) {
        try {
          const accResp = await fetch(`https://api.pluggy.ai/accounts?itemId=${encodeURIComponent(itemId)}`, {
            headers: { 'X-API-KEY': apiKey },
          });
          if (accResp.ok) {
            const accJson = await accResp.json();
            const results = accJson.results || accJson;
            if (Array.isArray(results)) {
              fetchedAccounts = results.map((a: any) => ({
                pluggy_account_id: a.id,
                institution_name: a.marketingName || a.name || 'Banco Conectado',
                account_type: a.type === 'CREDIT' ? 'CREDIT' : 'BANK',
                account_subtype: a.subtype,
                name: a.name || 'Conta Corrente',
                balance: Number(a.balance || 0),
                currency_code: a.currencyCode || 'BRL',
              }));
            }
          }
        } catch (fetchErr) {
          console.warn('[PluggyConnectModal] Nota ao buscar contas na Pluggy:', fetchErr);
        }
      }

      // Registra a conexão e sincroniza contas no backend do Vito
      try {
        await api.finance.sync({
          pluggy_item_id: itemId,
          accounts: fetchedAccounts,
          transactions: [],
        });
      } catch {
        try {
          await api.finance.createConnection({
            pluggy_item_id: itemId,
            connector_id: 200,
            institution_name: fetchedAccounts[0]?.institution_name || 'Open Finance',
          });
        } catch {}
      }

      hapticFeedback.selection();
      dataSync.notify('refresh_finance');
      await loadConnections();
      onConnectionSuccess?.();
    } catch (e: any) {
      Alert.alert('Open Finance', e?.message || 'Falha ao abrir conexão bancária.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDeleteConnection = (conn: FinanceConnection) => {
    Alert.alert(
      'Desconectar Banco',
      `Deseja realmente remover a conexão com "${conn.institution_name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticFeedback.medium();
              await api.finance.deleteConnection(conn.id);
              dataSync.notify('refresh_finance');
              loadConnections();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Falha ao desconectar.');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surf, borderColor: colors.line }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.ink }]}>Bancos & Open Finance</Text>
              <Text style={[styles.subtitle, { color: colors.muted }]}>
                Conexões criptografadas de leitura via Meu Pluggy
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={tokens.hitSlop.sm}>
              <MaterialIcons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Banner de Segurança */}
          <View style={[styles.securityPill, { backgroundColor: colors.bg, borderColor: colors.line }]}>
            <MaterialIcons name="security" size={16} color="#10B981" />
            <Text style={[styles.securityText, { color: colors.muted }]}>
              Somente leitura · Consentimento revogável a qualquer momento
            </Text>
          </View>

          {/* Lista de Conexões */}
          <View style={styles.listContainer}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.ink} style={{ marginTop: 24 }} />
            ) : connections.length === 0 ? (
              <View style={styles.emptyBox}>
                <MaterialIcons name="account-balance" size={40} color={colors.muted} style={{ marginBottom: 10 }} />
                <Text style={[styles.emptyTitle, { color: colors.ink }]}>Nenhum banco conectado</Text>
                <Text style={[styles.emptyDesc, { color: colors.muted }]}>
                  Conecte seu Nubank, Itaú, Inter ou outras contas para habilitar o Safe-to-Spend inteligente.
                </Text>
              </View>
            ) : (
              <FlatList
                data={connections}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
                renderItem={({ item }) => (
                  <View style={[styles.connCard, { backgroundColor: colors.bg, borderColor: colors.line }]}>
                    <View style={styles.connIconBox}>
                      <MaterialIcons name="account-balance" size={20} color={colors.ink} />
                    </View>
                    <View style={styles.connInfoCol}>
                      <Text style={[styles.connName, { color: colors.ink }]}>{item.institution_name}</Text>
                      <Text style={[styles.connStatus, { color: item.status === 'UPDATED' ? '#10B981' : '#EF4444' }]}>
                        {item.status === 'UPDATED' ? 'Sincronizado' : 'Atenção necessária'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteConnection(item)}
                      hitSlop={tokens.hitSlop.sm}
                      style={styles.trashBtn}
                    >
                      <MaterialIcons name="delete-outline" size={20} color={colors.muted} />
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>

          {/* Botão Conectar */}
          <TouchableOpacity
            style={[styles.primaryConnectBtn, { backgroundColor: colors.ink }]}
            onPress={handleOpenPluggyWidget}
            disabled={connecting}
            activeOpacity={0.8}
          >
            {connecting ? (
              <ActivityIndicator size="small" color={colors.bg} />
            ) : (
              <>
                <MaterialIcons name="add" size={20} color={colors.bg} />
                <Text style={[styles.primaryConnectBtnText, { color: colors.bg }]}>
                  {connections.length > 0 ? 'Conectar Outro Banco' : 'Conectar com Meu Pluggy'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, padding: 20, maxHeight: '80%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '700', fontFamily: tokens.typography.family.semibold },
  subtitle: { fontSize: 12.5, marginTop: 2 },
  closeBtn: { padding: 4 },
  securityPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  securityText: { fontSize: 11.5, fontWeight: '500' },
  listContainer: { minHeight: 160, maxHeight: 260 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  emptyDesc: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  connCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1 },
  connIconBox: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  connInfoCol: { flex: 1 },
  connName: { fontSize: 14, fontWeight: '600' },
  connStatus: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  trashBtn: { padding: 6 },
  primaryConnectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 25, marginTop: 16 },
  primaryConnectBtnText: { fontSize: 15, fontWeight: '600' },
});
