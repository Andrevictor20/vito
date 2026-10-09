import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationPriority } from '../../types';
import { M3Switch } from '../ui/M3Switch';

interface NotificationSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const {
    settings,
    permissionGranted,
    requestPermissions,
    updateSettings,
  } = useNotifications();

  const handleToggleEnabled = async (value: boolean) => {
    if (value && !permissionGranted) {
      const res = await requestPermissions(true);
      if (!res.granted) {
        Alert.alert(
          'Permissão Necessária',
          'Para receber alertas de compromissos, autorize as notificações nas configurações do seu aparelho.'
        );
        return;
      }
    }
    await updateSettings({ enabled: value });
  };

  const handleSelectPriority = async (priority: NotificationPriority) => {
    await updateSettings({ defaultPriority: priority });
  };

  const handleSelectMinutes = async (minutes: number) => {
    await updateSettings({ reminderMinutesBefore: minutes });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
              {/* Grab Bar & Top Bar */}
              <View style={styles.header}>
                <View style={[styles.grabBar, { backgroundColor: colors.outlineVariant }]} />
                <View style={styles.titleRow}>
                  <View style={styles.titleLeft}>
                    <View style={[styles.titleIconBox, { backgroundColor: colors.surfaceContainerHigh }]}>
                      <MaterialIcons name="notifications-active" size={20} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={[styles.title, { color: colors.onSurface }]}>Notificações & Alertas</Text>
                      <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
                        Alertas discretos e pontuais
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.closeBtn, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]}
                    onPress={onClose}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="close" size={18} color={colors.onSurface} />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* 1. Ativar Notificações */}
                <View style={[styles.card, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <MaterialIcons name="notifications" size={20} color={colors.primary} />
                      <View>
                        <Text style={[styles.cardTitle, { color: colors.onSurface }]}>Alertas Ativos</Text>
                        <Text style={[styles.cardSub, { color: colors.onSurfaceVariant }]}>
                          Lembretes automáticos para compromissos
                        </Text>
                      </View>
                    </View>
                    <M3Switch
                      value={settings.enabled}
                      onValueChange={handleToggleEnabled}
                    />
                  </View>

                  {!permissionGranted && (
                    <TouchableOpacity
                      style={[styles.permissionBanner, { backgroundColor: isDark ? '#3F2C1D' : '#FFF3E0', borderColor: '#F59E0B' }]}
                      onPress={() => {
                        requestPermissions(true).catch(() => {});
                      }}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="warning" size={18} color="#D97706" />
                      <Text style={[styles.permissionText, { color: isDark ? '#FDE68A' : '#B45309' }]}>
                        Permissão pendente no aparelho. Toque para conceder.
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* 2. Nível de Prioridade (Padrão vs Silencioso) */}
                <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>PRIORIDADE DO ALERTA</Text>
                <View style={styles.priorityGrid}>

                  {/* Padrão */}
                  <TouchableOpacity
                    style={[
                      styles.priorityOption,
                      { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant },
                      settings.defaultPriority === 'default' && {
                        borderColor: colors.primary,
                        backgroundColor: isDark ? '#242427' : '#F4F4F5',
                      },
                    ]}
                    onPress={() => handleSelectPriority('default')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.priorityTop}>
                      <View style={[styles.priorityIconBox, { backgroundColor: settings.defaultPriority === 'default' ? colors.primary : colors.surfaceContainerHighest }]}>
                        <MaterialIcons
                          name="notifications-active"
                          size={18}
                          color={settings.defaultPriority === 'default' ? colors.onPrimary : colors.onSurface}
                        />
                      </View>
                      {settings.defaultPriority === 'default' && (
                        <MaterialIcons name="check-circle" size={18} color={colors.primary} />
                      )}
                    </View>
                    <Text style={[styles.priorityName, { color: colors.onSurface }]}>Padrão</Text>
                    <Text style={[styles.priorityDesc, { color: colors.onSurfaceVariant }]}>
                      Som suave do sistema e banner visual no topo da tela.
                    </Text>
                  </TouchableOpacity>

                  {/* Silencioso */}
                  <TouchableOpacity
                    style={[
                      styles.priorityOption,
                      { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant },
                      settings.defaultPriority === 'silent' && {
                        borderColor: colors.primary,
                        backgroundColor: isDark ? '#242427' : '#F4F4F5',
                      },
                    ]}
                    onPress={() => handleSelectPriority('silent')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.priorityTop}>
                      <View style={[styles.priorityIconBox, { backgroundColor: settings.defaultPriority === 'silent' ? colors.primary : colors.surfaceContainerHighest }]}>
                        <MaterialIcons
                          name="notifications-off"
                          size={18}
                          color={settings.defaultPriority === 'silent' ? colors.onPrimary : colors.onSurface}
                        />
                      </View>
                      {settings.defaultPriority === 'silent' && (
                        <MaterialIcons name="check-circle" size={18} color={colors.primary} />
                      )}
                    </View>
                    <Text style={[styles.priorityName, { color: colors.onSurface }]}>Silencioso</Text>
                    <Text style={[styles.priorityDesc, { color: colors.onSurfaceVariant }]}>
                      Apenas card discreto sem tocar som ou vibrar.
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 3. Antecedência */}
                <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>ANTECEDÊNCIA DO LEMBRETE</Text>
                <View style={styles.chipsRow}>
                  {[5, 10, 15, 30, 60].map((min) => {
                    const isSelected = settings.reminderMinutesBefore === min;
                    return (
                      <TouchableOpacity
                        key={min}
                        style={[
                          styles.chip,
                          { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant },
                          isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                        onPress={() => handleSelectMinutes(min)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: colors.onSurface },
                            isSelected && { color: colors.onPrimary, fontWeight: '700' },
                          ]}
                        >
                          {min === 60 ? '1 hora' : `${min} min`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>


              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: MD3Shapes.extraLarge,
    borderTopRightRadius: MD3Shapes.extraLarge,
    borderWidth: 1,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  grabBar: {
    width: 36,
    height: 4,
    borderRadius: MD3Shapes.full,
    alignSelf: 'center',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleIconBox: {
    width: 38,
    height: 38,
    borderRadius: MD3Shapes.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: tokens.typography.size.md,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: tokens.typography.size.xs,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  card: {
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
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
  cardTitle: {
    fontSize: tokens.typography.size.sm,
    fontWeight: '600',
  },
  cardSub: {
    fontSize: tokens.typography.size.xs,
    marginTop: 2,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: MD3Shapes.small,
    borderWidth: 1,
    marginTop: 12,
  },
  permissionText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: '600',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  priorityGrid: {
    gap: 10,
    marginBottom: 20,
  },
  priorityOption: {
    borderRadius: MD3Shapes.medium,
    borderWidth: 1.5,
    padding: 14,
  },
  priorityTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  priorityIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityName: {
    fontSize: tokens.typography.size.sm,
    fontWeight: '700',
    marginBottom: 4,
  },
  priorityDesc: {
    fontSize: tokens.typography.size.xs,
    lineHeight: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: '500',
  },
  testButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  testBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
  },
  testBtnText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: '600',
  },
  testFeedback: {
    marginTop: 12,
    padding: 10,
    borderRadius: MD3Shapes.small,
    alignItems: 'center',
  },
  testFeedbackText: {
    fontSize: tokens.typography.size.xs,
    fontWeight: '700',
  },
});
