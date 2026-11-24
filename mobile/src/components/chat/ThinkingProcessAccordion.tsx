import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { ProtoUiIcon } from '../../icons/ProtoUiIcons';
import { useTheme } from '../../context/ThemeContext';
import { tokens } from '../../theme/tokens';
import { ChatThinkingIndicator } from './ChatThinkingIndicator';

export interface ThinkingProcessAccordionProps {
  steps?: string[];
  isStreaming?: boolean;
}

/**
 * ThinkingProcessAccordion exibe o indicador orgânico de 3 pontos (.typing)
 * e, quando há etapas de ferramentas/sub-agentes emitidas pelo streaming SSE do ADK,
 * permite expandir as ações executadas com transparência e zero poluição visual.
 */
export const ThinkingProcessAccordion: React.FC<ThinkingProcessAccordionProps> = ({
  steps = [],
  isStreaming = true,
}) => {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  if (steps.length === 0) {
    return isStreaming ? <ChatThinkingIndicator /> : null;
  }

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[
          styles.headerButton,
          {
            backgroundColor: colors.surf,
            borderColor: colors.line,
          },
        ]}
        onPress={() => setExpanded((prev) => !prev)}
        hitSlop={tokens.hitSlop.sm}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Ver etapas de raciocínio do Vito"
      >
        <ProtoUiIcon name="auto-awesome" size={14} color={colors.primary || colors.ink} />
        <Text style={[styles.headerText, { color: colors.ink }]} numberOfLines={1}>
          {isStreaming
            ? `Executando: ${steps[steps.length - 1]}`
            : `${steps.length} ${steps.length === 1 ? 'etapa concluída' : 'etapas concluídas'}`}
        </Text>
        <ProtoUiIcon
          name={expanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={16}
          color={colors.muted}
        />
      </TouchableOpacity>

      {expanded && (
        <View
          style={[
            styles.stepsBox,
            {
              backgroundColor: colors.surf,
              borderColor: colors.line,
            },
          ]}
        >
          {steps.map((step, idx) => (
            <View key={`${step}-${idx}`} style={styles.stepRow}>
              <ProtoUiIcon
                name="check-circle-outline"
                size={13}
                color={colors.primary || colors.ink}
              />
              <Text style={[styles.stepText, { color: colors.muted }]}>{step}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
    marginVertical: 6,
    maxWidth: '92%',
  },
  headerButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
  },
  headerText: {
    fontSize: 12.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  stepsBox: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepText: {
    fontSize: 12,
    lineHeight: 17,
  },
});
