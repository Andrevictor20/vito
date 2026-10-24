import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { Trigger } from '../../types';

interface TriggerReportsHeaderProps {
  trigger: Trigger;
  categoryMeta: any;
  categoryColor: string;
  categoryBg: string;
  frequencyLabel: string;
  lastCheckLabel: string;
  runningNow: boolean;
  errorMessage: string | null;
  logsCount: number;
  loading: boolean;
  refreshing: boolean;
  onRunNow: () => void;
  onRetry: () => void;
}

export const TriggerReportsHeader: React.FC<TriggerReportsHeaderProps> = ({
  trigger,
  categoryMeta,
  categoryColor,
  categoryBg,
  lastCheckLabel,
  runningNow,
  errorMessage,
  logsCount,
  loading,
  refreshing,
  onRunNow,
  onRetry,
}) => {
  const { colors } = useTheme();
  const isActive = trigger.status === 'active';

  return (
    <View style={styles.container}>
      {/* 1. Hero Card Curvo Executivo (Concentric Shape Lock 24px) */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: colors.bg,
            borderColor: colors.line,
          },
        ]}
      >
        {/* Linha Superior: Pílula de Status Viva + Horário da Checagem */}
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isActive
                  ? (colors.greenBg || 'rgba(11, 154, 95, 0.14)')
                  : colors.surf,
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isActive ? (colors.acc || '#0b9a5f') : colors.muted },
              ]}
            />
            <Text
              style={[
                styles.statusPillText,
                { color: isActive ? (colors.acc || '#0b9a5f') : colors.muted },
              ]}
            >
              {isActive ? 'VIGÍLIA ATIVA' : 'VIGÍLIA PAUSADA'}
            </Text>
          </View>

          <View style={styles.lastCheckWrapper}>
            <MaterialIcons name="schedule" size={13} color={colors.muted} />
            <Text style={[styles.lastCheckText, { color: colors.muted }]}>
              {lastCheckLabel}
            </Text>
          </View>
        </View>

        {/* Linha Central: Chip Temático Grande + Título em Destaque */}
        <View style={styles.heroMainRow}>
          <View style={[styles.heroIconChip, { backgroundColor: categoryBg }]}>
            <MaterialIcons name={categoryMeta.icon} size={22} color={categoryColor} />
          </View>
          <View style={styles.heroTextCol}>
            <Text
              style={[
                styles.heroTitle,
                { color: colors.ink, fontFamily: tokens.typography.family.montserratBold },
              ]}
              numberOfLines={2}
            >
              {trigger.title}
            </Text>
            <Text style={[styles.heroSub, { color: colors.muted }]} numberOfLines={1}>
              {trigger.query || `Monitorando continuamente em ${categoryMeta.label.toLowerCase()}`}
            </Text>
          </View>
        </View>

        {/* Botão em Pílula "Verificar Agora" */}
        <TouchableOpacity
          style={[
            styles.runButton,
            { backgroundColor: colors.ink },
            runningNow && { opacity: 0.8 },
          ]}
          onPress={onRunNow}
          disabled={runningNow}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={runningNow ? 'Pesquisando notícias e fatos' : 'Verificar agora'}
        >
          {runningNow ? (
            <>
              <ActivityIndicator size="small" color={colors.bg} />
              <Text style={[styles.runButtonText, { color: colors.bg }]}>
                Varrendo fatos recentes…
              </Text>
            </>
          ) : (
            <>
              <MaterialIcons name="bolt" size={18} color={colors.bg} />
              <Text style={[styles.runButtonText, { color: colors.bg }]}>
                Verificar Agora
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Caixa de Erro Fluida (se houver) */}
        {!!errorMessage && (
          <View
            style={[
              styles.errorBox,
              { backgroundColor: colors.redBg || '#fde6ec', borderColor: colors.red || '#d6355a' },
            ]}
          >
            <MaterialIcons name="error-outline" size={17} color={colors.red || '#d6355a'} />
            <Text
              style={[styles.errorText, { color: colors.red || '#d6355a' }]}
              numberOfLines={2}
            >
              {errorMessage}
            </Text>
            <TouchableOpacity
              onPress={onRetry}
              style={[styles.errorRetryPill, { backgroundColor: colors.bg }]}
            >
              <Text style={[styles.errorRetryText, { color: colors.red || '#d6355a' }]}>
                Tentar de novo
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 2. Cabeçalho Editorial da Seção de Histórico */}
      <View style={styles.historyHeader}>
        <View style={styles.historyHeaderLeft}>
          <Text
            style={[
              styles.historyTitle,
              { color: colors.ink, fontFamily: tokens.typography.family.montserratBold },
            ]}
          >
            Histórico de Notícias & Eventos
          </Text>
          <View
            style={[
              styles.countBadge,
              { backgroundColor: colors.surf, borderColor: colors.line },
            ]}
          >
            <Text style={[styles.countBadgeText, { color: colors.muted }]}>
              {logsCount}
            </Text>
          </View>
        </View>

        {loading && !refreshing && (
          <ActivityIndicator size="small" color={colors.primary} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    marginBottom: 20,
    shadowColor: 'rgba(20,25,22,0.06)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 14,
    gap: 6,
  },
  statusDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  lastCheckWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lastCheckText: {
    fontSize: 12,
    fontWeight: '500',
  },
  heroMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  heroIconChip: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heroTextCol: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 18.5,
    lineHeight: 23,
    letterSpacing: -0.3,
  },
  heroSub: {
    fontSize: 12.5,
    marginTop: 2,
  },
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 23,
    gap: 7,
  },
  runButtonText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 12,
    borderWidth: 1,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  errorRetryPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  errorRetryText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  historyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyTitle: {
    fontSize: 16.5,
    letterSpacing: -0.2,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  countBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
});
