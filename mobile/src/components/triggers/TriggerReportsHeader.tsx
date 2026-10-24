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
import { VitoSwitch } from '../ui/VitoSwitch';

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
  onBack: () => void;
  onRunNow: () => void;
  onRetry: () => void;
  onToggle?: (id: string) => void;
  onOpenTopMenu: () => void;
}

export const TriggerReportsHeader: React.FC<TriggerReportsHeaderProps> = ({
  trigger,
  categoryMeta,
  categoryColor,
  categoryBg,
  frequencyLabel,
  lastCheckLabel,
  runningNow,
  errorMessage,
  logsCount,
  loading,
  refreshing,
  onBack,
  onRunNow,
  onRetry,
  onToggle,
  onOpenTopMenu,
}) => {
  const { colors } = useTheme();
  const isActive = trigger.status === 'active';

  return (
    <View style={styles.container}>
      {/* Top Bar em linha única: [← Voltar + título/meta] ...... [Switch + ⋯] */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: colors.bg,
            borderBottomColor: colors.line,
          },
        ]}
      >
        <View style={styles.topLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <MaterialIcons name="arrow-back" size={22} color={colors.ink} />
          </TouchableOpacity>

          <View style={styles.titleBlock}>
            <Text
              style={[
                styles.topTitle,
                { color: colors.ink, fontFamily: tokens.typography.family.semibold },
              ]}
              numberOfLines={1}
            >
              {trigger.title}
            </Text>
            <Text style={[styles.topMeta, { color: colors.muted }]} numberOfLines={1}>
              {`${categoryMeta.label} · ${frequencyLabel}`}
            </Text>
          </View>
        </View>

        <View style={styles.topRight}>
          {onToggle && (
            <VitoSwitch value={isActive} onValueChange={() => onToggle(trigger.id)} />
          )}
          <TouchableOpacity
            style={[styles.moreButton, { borderColor: colors.line }]}
            onPress={onOpenTopMenu}
            accessibilityRole="button"
            accessibilityLabel="Opções do radar"
          >
            <MaterialIcons name="more-vert" size={20} color={colors.ink} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hero Card Executivo */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: colors.bg,
            borderColor: colors.line,
          },
        ]}
      >
        <View style={styles.heroStatusRow}>
          <View style={styles.statusIndicatorRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isActive ? (colors.acc || '#0b9a5f') : colors.muted },
              ]}
            />
            <Text style={[styles.statusText, { color: colors.ink }]}>
              {isActive ? 'VIGÍLIA ATIVA' : 'VIGÍLIA PAUSADA'}
            </Text>
          </View>

          <Text style={[styles.lastCheckText, { color: colors.muted }]}>
            {lastCheckLabel}
          </Text>
        </View>

        {/* Botão de Verificação Imediata */}
        <TouchableOpacity
          style={[
            styles.runButton,
            { backgroundColor: colors.ink },
            runningNow && { opacity: 0.75 },
          ]}
          onPress={onRunNow}
          disabled={runningNow}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={runningNow ? 'Pesquisando notícias' : 'Verificar agora'}
        >
          {runningNow ? (
            <>
              <ActivityIndicator size="small" color={colors.bg} />
              <Text style={[styles.runButtonText, { color: colors.bg }]}>
                Buscando fatos recentes…
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

        {/* Mensagem de Erro (se houver) */}
        {!!errorMessage && (
          <View style={[styles.errorBox, { backgroundColor: colors.redBg || '#fde6ec' }]}>
            <MaterialIcons name="error-outline" size={16} color={colors.red || '#d6355a'} />
            <Text style={[styles.errorText, { color: colors.red || '#d6355a' }]} numberOfLines={2}>
              {errorMessage}
            </Text>
            <TouchableOpacity onPress={onRetry}>
              <Text style={[styles.errorRetryText, { color: colors.red || '#d6355a' }]}>
                Repetir
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Cabeçalho da Lista de Histórico */}
      <View style={styles.historySectionHeader}>
        <View style={styles.historyTitleRow}>
          <Text
            style={[
              styles.historyTitle,
              { color: colors.ink, fontFamily: tokens.typography.family.semibold },
            ]}
          >
            Histórico de Notícias & Eventos
          </Text>
          <View style={[styles.countBadge, { backgroundColor: colors.surf }]}>
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
    marginBottom: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  backButton: {
    paddingRight: 10,
  },
  titleBlock: {
    flex: 1,
  },
  topTitle: {
    fontSize: 16.5,
    letterSpacing: -0.3,
  },
  topMeta: {
    fontSize: 12,
    marginTop: 1,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moreButton: {
    padding: 6,
    borderRadius: 10,
  },
  heroCard: {
    margin: 16,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  heroStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  lastCheckText: {
    fontSize: 12,
  },
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 21,
    gap: 6,
  },
  runButtonText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
  },
  errorRetryText: {
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  historySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyTitle: {
    fontSize: 15,
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
