import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';

export interface IntegrationsModalProps {
  visible: boolean;
  onClose: () => void;
  whatsAppStatus?: 'disconnected' | 'connecting' | 'connected' | null;
  gmailStatus?: { connected: boolean; email?: string } | null;
  onOpenWhatsApp: () => void;
  onOpenGmail: () => void;
}

export const IntegrationsModal: React.FC<IntegrationsModalProps> = ({
  visible,
  onClose,
  whatsAppStatus = null,
  gmailStatus = null,
  onOpenWhatsApp,
  onOpenGmail,
}) => {
  const { colors, isDark } = useTheme();

  const isWhatsAppConnected = whatsAppStatus === 'connected';
  const isGmailConnected = !!gmailStatus?.connected;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Integrações"
      subtitle="Conecte serviços externos para ampliar a inteligência do Vito"
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* CARD WHATSAPP */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#25D366' + '1A' }]}>
                <MaterialIcons name="chat" size={22} color="#25D366" />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={[styles.cardTitle, { color: colors.onSurface }]}>WhatsApp</Text>
                <Text style={[styles.cardSub, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                  {isWhatsAppConnected
                    ? 'Sessão ativa e pronto para receber @vito'
                    : 'Assistente e lembretes direto no seu WhatsApp'}
                </Text>
              </View>
            </View>

            {isWhatsAppConnected && (
              <View style={[styles.badgeActive, { backgroundColor: '#10B98120' }]}>
                <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.badgeText, { color: '#10B981' }]}>Conectado</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.actionBtn,
              isWhatsAppConnected
                ? {
                    borderColor: colors.outlineVariant,
                    borderWidth: 1,
                    backgroundColor: colors.surfaceContainerHigh,
                  }
                : {
                    backgroundColor: isDark ? colors.surfaceContainerHighest : colors.primary,
                    borderWidth: isDark ? 1 : 0,
                    borderColor: colors.outlineVariant,
                  },
            ]}
            onPress={() => {
              onClose();
              onOpenWhatsApp();
            }}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name={isWhatsAppConnected ? 'settings' : 'qr-code-scanner'}
              size={16}
              color={isWhatsAppConnected ? colors.onSurface : (isDark ? colors.onSurface : '#FFFFFF')}
            />
            <Text
              style={[
                styles.actionBtnText,
                { color: isWhatsAppConnected ? colors.onSurface : (isDark ? colors.onSurface : '#FFFFFF') },
              ]}
            >
              {isWhatsAppConnected ? 'Gerenciar WhatsApp' : 'Conectar WhatsApp'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* CARD GMAIL */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#EA4335' + '1A' }]}>
                <MaterialIcons name="mail" size={22} color="#EA4335" />
              </View>
              <View style={styles.cardTextCol}>
                <Text style={[styles.cardTitle, { color: colors.onSurface }]}>Gmail</Text>
                <Text style={[styles.cardSub, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                  {isGmailConnected
                    ? `Varredura ativa (${gmailStatus?.email || 'Conectado'})`
                    : 'Leitura de faturas, boletos e confirmações de voo'}
                </Text>
              </View>
            </View>

            {isGmailConnected && (
              <View style={[styles.badgeActive, { backgroundColor: '#10B98120' }]}>
                <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.badgeText, { color: '#10B981' }]}>Conectado</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.actionBtn,
              isGmailConnected
                ? {
                    borderColor: colors.outlineVariant,
                    borderWidth: 1,
                    backgroundColor: colors.surfaceContainerHigh,
                  }
                : {
                    backgroundColor: isDark ? colors.surfaceContainerHighest : colors.primary,
                    borderWidth: isDark ? 1 : 0,
                    borderColor: colors.outlineVariant,
                  },
            ]}
            onPress={() => {
              onClose();
              onOpenGmail();
            }}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name={isGmailConnected ? 'settings' : 'sync'}
              size={16}
              color={isGmailConnected ? colors.onSurface : (isDark ? colors.onSurface : '#FFFFFF')}
            />
            <Text
              style={[
                styles.actionBtnText,
                { color: isGmailConnected ? colors.onSurface : (isDark ? colors.onSurface : '#FFFFFF') },
              ]}
            >
              {isGmailConnected ? 'Gerenciar Gmail' : 'Conectar Conta Gmail'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 36,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
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
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextCol: {
    flex: 1,
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
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
