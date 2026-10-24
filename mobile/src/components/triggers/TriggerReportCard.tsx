import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { TriggerLog } from '../../types';
import {
  ParsedReportData,
  extractRadarBullets,
  extractRadarSources,
  isRadarUrgentOrBreaking,
} from '../../utils/radarReportUtils';
import { RadarMetricBanner } from './RadarMetricBanner';
import { RadarStructuredBullets } from './RadarStructuredBullets';
import { RadarSourcesRow } from './RadarSourceChip';
import { RadarBreakingBadge } from './RadarBreakingBadge';

interface TriggerReportCardProps {
  log: TriggerLog;
  parsed: ParsedReportData | null;
  categoryColor: string;
  categoryBg: string;
  onOpenMenu: (logId: string) => void;
  onAction: (kind: 'chat' | 'task' | 'schedule', log: TriggerLog, parsed: ParsedReportData | null) => void;
}

export const TriggerReportCard: React.FC<TriggerReportCardProps> = ({
  log,
  parsed,
  categoryColor,
  categoryBg,
  onOpenMenu,
  onAction,
}) => {
  const { colors } = useTheme();

  const isBreaking = isRadarUrgentOrBreaking(
    parsed?.urgency,
    parsed?.is_breaking,
    log.message
  );

  const bullets = extractRadarBullets(log.message, parsed);
  const sources = extractRadarSources(log.message, parsed);

  const headline = parsed?.summary?.trim() || log.message?.split('\n')[0] || 'Atualização da Vigília';
  const confidence = typeof parsed?.confidence === 'number' ? Math.round(parsed.confidence) : null;

  const formatRelative = (dateStr?: string): string => {
    if (!dateStr) return 'agora';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const diffMs = Date.now() - date.getTime();
      const minutes = Math.floor(diffMs / 60000);
      if (minutes < 1) return 'agora mesmo';
      if (minutes < 60) return `há ${minutes} min`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `há ${hours} h`;
      const days = Math.floor(hours / 24);
      if (days === 1) return 'ontem';
      return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.bg,
          borderColor: isBreaking ? colors.red : colors.line,
        },
        isBreaking && styles.breakingBorder,
      ]}
    >
      {/* Topo do Card: Tags de Urgência, Tempo, Relevância e Ações */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          {isBreaking && <RadarBreakingBadge label="URGENTE" />}
          <Text style={[styles.timeText, { color: colors.muted }]}>
            {formatRelative(log.triggered_at)}
          </Text>
          {confidence != null && (
            <Text style={[styles.confText, { color: colors.muted }]}>
              {` · ${confidence}% relevância`}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => onOpenMenu(log.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Opções do relatório"
        >
          <MaterialIcons name="more-vert" size={19} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Banner de Métrica (Placar de Jogos, Preço Alvo, Status) */}
      {parsed?.metric_value ? (
        <RadarMetricBanner
          label={parsed.metric_label}
          value={parsed.metric_value}
          categoryColor={categoryColor}
          categoryBg={categoryBg}
        />
      ) : null}

      {/* Manchete Principal */}
      <Text
        style={[
          styles.headlineText,
          { color: colors.ink, fontFamily: tokens.typography.family.semibold },
        ]}
      >
        {headline}
      </Text>

      {/* Bullets Estruturados (sem paredes de texto longo) */}
      <RadarStructuredBullets bullets={bullets} bulletColor={categoryColor} />

      {/* Fontes Verificadas com Favicons */}
      <RadarSourcesRow sources={sources} />

      {/* Rodapé de Ações Contextuais */}
      <View style={[styles.footerRow, { borderTopColor: colors.line }]}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.surf }]}
          onPress={() => onAction('chat', log, parsed)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="chat" size={14} color={colors.ink} />
          <Text style={[styles.actionBtnText, { color: colors.ink }]}>
            Conversar com Vito
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtnSecondary, { borderColor: colors.line }]}
          onPress={() => onAction('task', log, parsed)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="add-task" size={14} color={colors.muted} />
          <Text style={[styles.actionBtnSecondaryText, { color: colors.muted }]}>
            Criar Tarefa
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    shadowColor: 'rgba(20,25,22,0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 1,
  },
  breakingBorder: {
    borderLeftWidth: 3.5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  confText: {
    fontSize: 12,
  },
  menuBtn: {
    padding: 2,
  },
  headlineText: {
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
