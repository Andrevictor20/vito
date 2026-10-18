import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../context/ThemeContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { Button } from '../ui/Button';
import { api } from '../../services/api';
import { googleAuthService } from '../../services/googleAuthService';
import { tokens } from '../../theme/tokens';
import { styles } from './GmailConnectModal.styles';
import type {
  GmailStatusResponse,
  GmailScanResult,
  ScannedBill,
  ScannedFlight,
  UrgentEmail,
} from '../../services/api';

interface GmailConnectModalProps {
  visible: boolean;
  onClose: () => void;
  onStatusChanged?: () => void;
}

export const GmailConnectModal: React.FC<GmailConnectModalProps> = ({
  visible,
  onClose,
  onStatusChanged,
}) => {
  const { colors } = useTheme();

  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [status, setStatus] = useState<GmailStatusResponse | null>(null);
  const [scanResult, setScanResult] = useState<GmailScanResult | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getGmailStatus();
      setStatus(res);
    } catch {
      setStatus({ connected: false, email: '', last_scanned_at: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchStatus();
      setScanResult(null);
    }
  }, [visible, fetchStatus]);

  const handleConnect = async () => {
    try {
      const token = api.getToken();
      if (!token) {
        Alert.alert('Erro', 'Sessão expirada. Faça login novamente.');
        return;
      }
      const res = await googleAuthService.connectGmail(api.getBaseUrl(), token);
      await fetchStatus();
      onStatusChanged?.();
      Alert.alert('Sucesso', `Gmail (${res.email}) conectado com sucesso! O Vito agora pode escanear boletos e voos.`);
    } catch (err: any) {
      if (err?.message?.includes('cancelad')) {
        return;
      }
      Alert.alert('Erro na Conexão', err?.message || 'Falha ao conectar com o Gmail.');
    }
  };

  const handleDisconnect = async () => {
    Alert.alert(
      'Desconectar Gmail',
      'Tem certeza de que deseja desconectar o Gmail? O Vito deixará de ler boletos e alertas da sua caixa postal.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            setDisconnecting(true);
            try {
              await api.disconnectGmail();
              await fetchStatus();
              setScanResult(null);
              onStatusChanged?.();
              Alert.alert('Desconectado', 'Integração com Gmail removida com sucesso.');
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Falha ao desconectar Gmail.');
            } finally {
              setDisconnecting(false);
            }
          },
        },
      ]
    );
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await api.scanGmail({ days: 7, limit: 25 });
      setScanResult(res);
      await fetchStatus();
      onStatusChanged?.();
      const totalItems = res.bills.length + res.flights.length + res.urgent_emails.length;
      if (totalItems === 0) {
        Alert.alert('Varredura Concluída', `Foram analisados ${res.scanned_count} e-mails recentes. Nenhum boleto ou voo novo foi encontrado.`);
      }
    } catch (err: any) {
      Alert.alert('Erro na Varredura', err?.message || 'Falha ao escanear e-mails do Gmail.');
    } finally {
      setScanning(false);
    }
  };

  const copyToClipboard = async (code: string, id: string) => {
    await Clipboard.setStringAsync(code);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Integração Gmail"
      subtitle="Varredura inteligente de boletos, voos e avisos urgentes"
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>
              Verificando status do Gmail...
            </Text>
          </View>
        ) : !status?.connected ? (
          /* Estado Desconectado */
          <View style={styles.disconnectedBox}>
            <View style={[styles.heroIconBox, { backgroundColor: colors.surfaceContainerHigh }]}>
              <MaterialIcons name="mail-outline" size={32} color={colors.primary} />
            </View>

            <Text style={[styles.heroTitle, { color: colors.onSurface }]}>
              Ative a inteligência de e-mail do Vito
            </Text>

            <Text style={[styles.heroSubtitle, { color: colors.onSurfaceVariant }]}>
              Ao conectar sua caixa postal, os radares do Vito identificam automaticamente:
            </Text>

            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <MaterialIcons name="receipt-long" size={20} color="#0D9488" />
                <Text style={[styles.featureText, { color: colors.onSurface }]}>
                  <Text style={{ fontWeight: '700' }}>Boletos a pagar:</Text> valor, vencimento e linha digitável pronta para copiar e pagar no banco.
                </Text>
              </View>

              <View style={styles.featureItem}>
                <MaterialIcons name="flight-takeoff" size={20} color="#2563EB" />
                <Text style={[styles.featureText, { color: colors.onSurface }]}>
                  <Text style={{ fontWeight: '700' }}>Reservas de voos:</Text> código localizador, companhia aérea e horários de embarque.
                </Text>
              </View>

              <View style={styles.featureItem}>
                <MaterialIcons name="priority-high" size={20} color="#DC2626" />
                <Text style={[styles.featureText, { color: colors.onSurface }]}>
                  <Text style={{ fontWeight: '700' }}>E-mails críticos:</Text> avisos urgentes resumidos para você não perder prazos.
                </Text>
              </View>
            </View>

            <View style={[styles.privacyBox, { backgroundColor: colors.surfaceContainerLow }]}>
              <MaterialIcons name="security" size={16} color={colors.primary} />
              <Text style={[styles.privacyText, { color: colors.onSurfaceVariant }]}>
                Seus dados são criptografados com chave AES-256 militar no seu servidor isolado. O Vito nunca vende nem compartilha suas mensagens.
              </Text>
            </View>

            <Button
              label="Conectar Gmail com Google"
              variant="filled"
              icon={<MaterialIcons name="mail" size={18} color={colors.onPrimary} />}
              onPress={handleConnect}
              style={{ marginTop: tokens.spacing.sm }}
            />
          </View>
        ) : (
          /* Estado Conectado */
          <View style={styles.connectedBox}>
            <View style={[styles.statusCard, { backgroundColor: colors.surfaceContainerHigh }]}>
              <View style={styles.statusRow}>
                <View style={styles.statusEmailCol}>
                  <View style={styles.badgeRow}>
                    <View style={styles.greenDot} />
                    <Text style={[styles.badgeText, { color: '#16A34A' }]}>Conectado</Text>
                  </View>
                  <Text style={[styles.emailText, { color: colors.onSurface }]}>{status.email}</Text>
                </View>

                <TouchableOpacity
                  onPress={handleDisconnect}
                  disabled={disconnecting}
                  style={styles.disconnectBtn}
                  accessibilityLabel="Desconectar Gmail"
                >
                  {disconnecting ? (
                    <ActivityIndicator size="small" color={colors.error} />
                  ) : (
                    <Text style={[styles.disconnectText, { color: colors.error }]}>Desconectar</Text>
                  )}
                </TouchableOpacity>
              </View>

              {status.last_scanned_at && (
                <Text style={[styles.lastScannedText, { color: colors.onSurfaceVariant }]}>
                  Última varredura: {new Date(status.last_scanned_at).toLocaleString('pt-BR')}
                </Text>
              )}
            </View>

            <Button
              label={scanning ? 'Analisando mensagens...' : 'Escanear E-mails Agora'}
              variant="filled"
              icon={<MaterialIcons name="sync" size={18} color={colors.onPrimary} />}
              onPress={handleScan}
              isLoading={scanning}
              style={{ marginTop: tokens.spacing.xs }}
            />

            {/* Resultados da Varredura */}
            {scanResult && (
              <View style={styles.resultsContainer}>
                <Text style={[styles.resultsHeader, { color: colors.onSurface }]}>
                  Itens Detectados ({scanResult.bills.length + scanResult.flights.length + scanResult.urgent_emails.length})
                </Text>

                {/* Boletos Encontrados */}
                {scanResult.bills.map((bill: ScannedBill) => (
                  <View
                    key={bill.id}
                    style={[styles.resultCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardIconTitle}>
                        <MaterialIcons name="receipt" size={18} color="#0D9488" />
                        <Text style={[styles.cardTitle, { color: colors.onSurface }]} numberOfLines={1}>
                          {bill.subject || 'Boleto'}
                        </Text>
                      </View>
                      <Text style={[styles.amountTag, { color: '#0D9488' }]}>
                        {formatCurrency(bill.amount)}
                      </Text>
                    </View>

                    {bill.due_date ? (
                      <Text style={[styles.dueDateText, { color: colors.onSurfaceVariant }]}>
                        Vencimento: {bill.due_date}
                      </Text>
                    ) : null}

                    {bill.linha_digitavel ? (
                      <View style={[styles.codeBox, { backgroundColor: colors.surfaceContainerHighest }]}>
                        <Text style={[styles.codeText, { color: colors.onSurface }]} numberOfLines={1}>
                          {bill.linha_digitavel}
                        </Text>
                        <TouchableOpacity
                          style={styles.copyBtn}
                          onPress={() => copyToClipboard(bill.linha_digitavel, bill.id)}
                        >
                          <MaterialIcons
                            name={copiedIndex === bill.id ? 'check' : 'content-copy'}
                            size={16}
                            color={copiedIndex === bill.id ? '#16A34A' : colors.primary}
                          />
                          <Text
                            style={[
                              styles.copyText,
                              { color: copiedIndex === bill.id ? '#16A34A' : colors.primary },
                            ]}
                          >
                            {copiedIndex === bill.id ? 'Copiado!' : 'Copiar'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                ))}

                {/* Voos Encontrados */}
                {scanResult.flights.map((flight: ScannedFlight) => (
                  <View
                    key={flight.id}
                    style={[styles.resultCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardIconTitle}>
                        <MaterialIcons name="flight" size={18} color="#2563EB" />
                        <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
                          {flight.airline || 'Voo'} {flight.flight_number || ''}
                        </Text>
                      </View>
                      <View style={[styles.locatorBadge, { backgroundColor: '#DBEAFE' }]}>
                        <Text style={styles.locatorText}>Loc: {flight.booking_locator}</Text>
                      </View>
                    </View>

                    <Text style={[styles.flightRouteText, { color: colors.onSurfaceVariant }]}>
                      {flight.departure_airport || 'Origem'} ➔ {flight.arrival_airport || 'Destino'}
                    </Text>
                  </View>
                ))}

                {/* E-mails Urgentes */}
                {scanResult.urgent_emails.map((urgent: UrgentEmail) => (
                  <View
                    key={urgent.id}
                    style={[styles.resultCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardIconTitle}>
                        <MaterialIcons name="warning" size={18} color="#DC2626" />
                        <Text style={[styles.cardTitle, { color: colors.onSurface }]} numberOfLines={1}>
                          {urgent.subject}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.urgentReasonText, { color: '#DC2626' }]}>
                      {urgent.urgency_reason}
                    </Text>
                    {urgent.snippet ? (
                      <Text style={[styles.snippetText, { color: colors.onSurfaceVariant }]} numberOfLines={2}>
                        {urgent.snippet}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </BottomSheetModal>
  );
};
