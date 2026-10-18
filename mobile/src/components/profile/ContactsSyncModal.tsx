import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, FlatList, Share, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { hapticFeedback } from '../../theme/motion';
import { api } from '../../services/api';
import { syncAndMatchDeviceContacts, MatchedContactItem } from '../../services/contactMatchingService';
import { formatPhoneNumber } from '../../utils/phoneFormat';

interface ContactsSyncModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectContactForMeeting?: (contact: MatchedContactItem) => void;
}

export const ContactsSyncModal: React.FC<ContactsSyncModalProps> = ({
  visible,
  onClose,
  onSelectContactForMeeting,
}) => {
  const { colors } = useTheme();
  const [activeSource, setActiveSource] = useState<'device' | 'whatsapp'>('device');
  const [loading, setLoading] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [matches, setMatches] = useState<MatchedContactItem[]>([]);
  const [totalScanned, setTotalScanned] = useState(0);

  // WhatsApp Tab State
  const [waLoading, setWaLoading] = useState(false);
  const [waMatches, setWaMatches] = useState<MatchedContactItem[]>([]);
  const [waHasScanned, setWaHasScanned] = useState(false);
  const [waConnected, setWaConnected] = useState<boolean | null>(null);

  React.useEffect(() => {
    if (visible) {
      api.getWhatsAppStatus()
        .then((st) => setWaConnected(st.status === 'connected'))
        .catch(() => setWaConnected(false));
    }
  }, [visible]);

  const handleSyncWhatsApp = async () => {
    setWaLoading(true);
    try {
      const res = await api.getWhatsAppContacts();
      const mapped: MatchedContactItem[] = res.contacts.map((c) => ({
        userId: c.user_id,
        serverName: c.name,
        localName: c.name,
        phone: c.phone || '',
        email: c.email || '',
      }));
      setWaMatches(mapped);
      setWaHasScanned(true);
      hapticFeedback.success();
    } catch (err: any) {
      console.error('Erro ao sincronizar contatos do WhatsApp:', err);
      Alert.alert(
        'Falha no WhatsApp',
        'Não foi possível consultar os contatos do WhatsApp. Verifique se o WhatsApp está conectado no seu perfil.'
      );
      hapticFeedback.medium();
    } finally {
      setWaLoading(false);
    }
  };

  const handleSync = async () => {
    setLoading(true);
    setPermissionDenied(false);
    try {
      const result = await syncAndMatchDeviceContacts(api.p2p);
      if (!result.permissionGranted) {
        setPermissionDenied(true);
        hapticFeedback.medium();
        return;
      }
      setMatches(result.matched);
      setTotalScanned(result.totalScanned);
      setHasScanned(true);
      hapticFeedback.success();
    } catch (err: any) {
      console.error('Erro ao sincronizar contatos:', err);
      Alert.alert(
        'Falha no Matching',
        'Não foi possível conectar com o servidor para cruzar os contatos. Verifique sua conexão.'
      );
      hapticFeedback.medium();
    } finally {
      setLoading(false);
    }
  };

  const handleShareInvite = async () => {
    try {
      await Share.share({
        message:
          'Olá! Estou usando o Vito para agendamentos e reuniões com IA. Vamos marcar nossos compromissos por lá: https://vito.rasppi.cloud',
        title: 'Convite para o Vito',
      });
    } catch {}
  };

  const renderContactItem = (item: MatchedContactItem, isWhatsApp: boolean = false) => {
    const accent = isWhatsApp ? '#10B981' : colors.primary;
    const bgAvatar = isWhatsApp ? '#0B3322' : colors.surfaceContainerHigh;
    const fgAvatar = isWhatsApp ? '#10B981' : colors.primary;

    return (
      <View style={[styles.contactCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
        <View style={[styles.avatarBox, { backgroundColor: bgAvatar }]}>
          <Text style={[styles.avatarText, { color: fgAvatar }]}>
            {(item.localName || item.serverName || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.contactInfo}>
          <Text style={[styles.contactName, { color: colors.onSurface }]} numberOfLines={1}>
            {item.localName || item.serverName}
          </Text>
          {item.localName && item.localName !== item.serverName && (
            <Text style={[styles.contactAlias, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
              No Vito: {item.serverName}
            </Text>
          )}
          <Text style={[styles.contactSub, { color: colors.outline }]} numberOfLines={1}>
            {formatPhoneNumber(item.phone) || item.email}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.meetingActionBtn, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}
          onPress={() => {
            hapticFeedback.selection();
            onClose();
            if (onSelectContactForMeeting) {
              onSelectContactForMeeting(item);
            } else {
              handleShareInvite();
            }
          }}
          activeOpacity={0.7}
        >
          <MaterialIcons name="event" size={16} color={accent} />
          <Text style={[styles.meetingActionText, { color: accent }]}>
            Reunião
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Encontrar Amigos"
    >
      <View style={styles.container}>
        {/* Source Selector Tab */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeSource === 'device' && { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
            ]}
            onPress={() => setActiveSource('device')}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="contacts"
              size={16}
              color={activeSource === 'device' ? colors.primary : colors.outline}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeSource === 'device' ? colors.primary : colors.onSurfaceVariant },
              ]}
            >
              Agenda
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeSource === 'whatsapp' && { backgroundColor: '#0B3322', borderColor: '#10B981' },
            ]}
            onPress={() => setActiveSource('whatsapp')}
            activeOpacity={0.7}
          >
            <MaterialIcons
              name="chat"
              size={16}
              color={activeSource === 'whatsapp' ? '#10B981' : colors.outline}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeSource === 'whatsapp' ? '#10B981' : colors.onSurfaceVariant },
              ]}
            >
              WhatsApp
            </Text>
          </TouchableOpacity>
        </View>

        {activeSource === 'device' && (
          <>
        {/* Privacy Card */}
        <View style={[styles.privacyBanner, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]}>
          <MaterialIcons name="security" size={20} color={colors.primary} style={styles.privacyIcon} />
          <View style={styles.privacyTextCol}>
            <Text style={[styles.privacyTitle, { color: colors.onSurface }]}>
              Privacidade e Segurança
            </Text>
            <Text style={[styles.privacyDesc, { color: colors.onSurfaceVariant }]}>
              Seus contatos continuam protegidos no seu aparelho. O Vito apenas verifica quais dos seus contatos já usam o app para facilitar o agendamento de reuniões.
            </Text>
          </View>
        </View>

        {/* Permission Denied Notice */}
        {permissionDenied && (
          <View style={[styles.alertBanner, { backgroundColor: '#3E1C1A', borderColor: '#7E2A24' }]}>
            <MaterialIcons name="error-outline" size={20} color="#FF8E85" />
            <Text style={styles.alertText}>
              Permissão negada. O Vito precisa de acesso aos contatos para encontrar quem já utiliza o aplicativo.
            </Text>
          </View>
        )}

        {/* Sync Trigger Button */}
        <TouchableOpacity
          style={[styles.syncButton, { backgroundColor: colors.primary }]}
          onPress={handleSync}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <>
              <MaterialIcons name="sync" size={18} color={colors.onPrimary} />
              <Text style={[styles.syncButtonText, { color: colors.onPrimary }]}>
                {hasScanned ? 'Atualizar Lista' : 'Buscar Amigos na Agenda'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Results Area */}
        {hasScanned && (
          <View style={styles.resultsArea}>
            <View style={styles.resultsHeader}>
              <Text style={[styles.resultsTitle, { color: colors.onSurface }]}>
                Amigos no Vito ({matches.length})
              </Text>
              <Text style={[styles.scannedCount, { color: colors.outline }]}>
                {totalScanned} contatos verificados
              </Text>
            </View>

            {matches.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surfaceContainer }]}>
                <MaterialIcons name="group-off" size={36} color={colors.outline} />
                <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                  Nenhum contato encontrado ainda
                </Text>
                <Text style={[styles.emptyDesc, { color: colors.onSurfaceVariant }]}>
                  Seus amigos da agenda ainda não têm o Vito instalado ou ainda não adicionaram o número de celular no perfil.
                </Text>
                <TouchableOpacity
                  style={[styles.inviteButton, { borderColor: colors.primary }]}
                  onPress={handleShareInvite}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="share" size={16} color={colors.primary} />
                  <Text style={[styles.inviteButtonText, { color: colors.primary }]}>
                    Compartilhar Convite
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={matches}
                keyExtractor={(item) => item.userId}
                scrollEnabled={false}
                renderItem={({ item }) => renderContactItem(item, false)}
              />
            )}
          </View>
        )}
          </>
        )}

        {/* WhatsApp Tab View */}
        {activeSource === 'whatsapp' && (
          <>
            {waConnected === false ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surfaceContainer }]}>
                <MaterialIcons name="link-off" size={36} color={colors.outline} />
                <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                  WhatsApp Não Conectado
                </Text>
                <Text style={[styles.emptyDesc, { color: colors.onSurfaceVariant }]}>
                  Conecte sua conta do WhatsApp na aba Perfil para sincronizar seus contatos e descobrir quem já utiliza o Vito.
                </Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.syncButton, { backgroundColor: '#10B981' }]}
                  onPress={handleSyncWhatsApp}
                  disabled={waLoading}
                  activeOpacity={0.8}
                >
                  {waLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <MaterialIcons name="sync" size={18} color="#FFFFFF" />
                      <Text style={[styles.syncButtonText, { color: '#FFFFFF' }]}>
                        {waHasScanned ? 'Atualizar Contatos WhatsApp' : 'Buscar Amigos no WhatsApp'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {waHasScanned && (
                  <View style={styles.resultsArea}>
                    <View style={styles.resultsHeader}>
                      <Text style={[styles.resultsTitle, { color: colors.onSurface }]}>
                        Amigos no Vito ({waMatches.length})
                      </Text>
                      <Text style={[styles.scannedCount, { color: '#10B981' }]}>
                        via WhatsApp
                      </Text>
                    </View>

                    {waMatches.length === 0 ? (
                      <View style={[styles.emptyCard, { backgroundColor: colors.surfaceContainer }]}>
                        <MaterialIcons name="group-off" size={36} color={colors.outline} />
                        <Text style={[styles.emptyTitle, { color: colors.onSurface }]}>
                          Nenhum contato encontrado
                        </Text>
                        <Text style={[styles.emptyDesc, { color: colors.onSurfaceVariant }]}>
                          Nenhum dos seus contatos do WhatsApp possui cadastro no Vito no momento.
                        </Text>
                      </View>
                    ) : (
                      <FlatList
                        data={waMatches}
                        keyExtractor={(item) => item.userId}
                        scrollEnabled={false}
                        renderItem={({ item }) => renderContactItem(item, true)}
                      />
                    )}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: tokens.spacing.sm,
    gap: tokens.spacing.md,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: tokens.spacing.xs,
    padding: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: MD3Shapes.medium,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: tokens.spacing.sm,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabText: {
    fontSize: tokens.typography.size.labelMedium,
    fontWeight: tokens.typography.weight.medium,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
  },
  privacyIcon: { marginTop: 2 },
  privacyTextCol: { flex: 1 },
  privacyTitle: {
    fontSize: tokens.typography.size.bodyMedium,
    fontWeight: tokens.typography.weight.semibold,
    marginBottom: 2,
  },
  privacyDesc: { fontSize: tokens.typography.size.bodySmall, lineHeight: 18 },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    padding: tokens.spacing.md,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
  },
  alertText: { color: '#FF8E85', fontSize: tokens.typography.size.bodySmall, flex: 1 },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: MD3Shapes.medium,
  },
  syncButtonText: { fontSize: tokens.typography.size.bodyMedium, fontWeight: tokens.typography.weight.semibold },
  resultsArea: { gap: tokens.spacing.sm, marginTop: tokens.spacing.xs },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultsTitle: { fontSize: tokens.typography.size.bodyMedium, fontWeight: tokens.typography.weight.semibold },
  scannedCount: { fontSize: tokens.typography.size.bodySmall },
  emptyCard: { alignItems: 'center', justifyContent: 'center', padding: tokens.spacing.lg, borderRadius: MD3Shapes.medium, gap: tokens.spacing.xs },
  emptyTitle: { fontSize: tokens.typography.size.bodyMedium, fontWeight: tokens.typography.weight.semibold, marginTop: tokens.spacing.xs },
  emptyDesc: { fontSize: tokens.typography.size.bodySmall, textAlign: 'center', lineHeight: 18 },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
    marginTop: tokens.spacing.sm,
  },
  inviteButtonText: { fontSize: tokens.typography.size.bodySmall, fontWeight: tokens.typography.weight.medium },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: tokens.spacing.sm,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    marginBottom: tokens.spacing.xs,
    gap: tokens.spacing.sm,
  },
  avatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: tokens.typography.size.bodyLarge,
    fontWeight: tokens.typography.weight.bold,
  },
  contactInfo: { flex: 1 },
  contactName: {
    fontSize: tokens.typography.size.bodyMedium,
    fontWeight: tokens.typography.weight.semibold,
  },
  contactAlias: { fontSize: tokens.typography.size.labelSmall },
  contactSub: { fontSize: tokens.typography.size.bodySmall },
  meetingActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
  },
  meetingActionText: {
    fontSize: tokens.typography.size.labelSmall,
    fontWeight: tokens.typography.weight.semibold,
  },
});
