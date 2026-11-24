import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { ProtoUiIcon } from '../../../icons/ProtoUiIcons';
import { useTheme } from '../../../context/ThemeContext';
import { tokens } from '../../../theme/tokens';
import { ChatThinkingIndicator } from './ChatThinkingIndicator';

export interface ThinkingProcessAccordionProps {
  steps?: string[];
  isStreaming?: boolean;
}

/**
 * ThinkingProcessAccordion exibe o indicador orgânico de 3 pontos (.typing)
 * e, quando há etapas de ações emitidas pelo streaming SSE do ADK,
 * mostra um resumo limpo e expansível em timeline do que o Vito está fazendo.
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

  const currentStep = steps[steps.length - 1];

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[
          styles.headerButton,
          {
            backgroundColor: colors.surf,
            borderColor: colors.hairline || colors.line,
          },
        ]}
        onPress={() => setExpanded((prev) => !prev)}
        hitSlop={tokens.hitSlop.sm}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Ver etapas de execução do Vito"
      >
        <View style={[styles.badgeDot, { backgroundColor: colors.primary || colors.ink }]} />
        <Text style={[styles.headerText, { color: colors.ink }]} numberOfLines={1}>
          {isStreaming
            ? currentStep
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
              borderColor: colors.hairline || colors.line,
            },
          ]}
        >
          {steps.map((step, idx) => {
            const isLast = idx === steps.length - 1;
            const isActive = isStreaming && isLast;
            return (
              <View key={`${step}-${idx}`} style={styles.stepRow}>
                <View style={styles.timelineCol}>
                  <View
                    style={[
                      styles.stepIconWrap,
                      {
                        backgroundColor: isActive
                          ? colors.primary || colors.ink
                          : 'transparent',
                        borderColor: colors.primary || colors.ink,
                      },
                    ]}
                  >
                    {!isActive && (
                      <ProtoUiIcon
                        name="check"
                        size={10}
                        color={colors.primary || colors.ink}
                      />
                    )}
                  </View>
                  {!isLast && (
                    <View
                      style={[
                        styles.timelineConnector,
                        { backgroundColor: colors.hairline || colors.line },
                      ]}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.stepText,
                    { color: isActive ? colors.ink : colors.muted },
                    isActive && styles.stepTextActive,
                  ]}
                >
                  {step}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
    marginVertical: 6,
    maxWidth: '100%',
  },
  headerButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  headerText: {
    fontSize: 12.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  stepsBox: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  timelineCol: {
    alignItems: 'center',
    width: 16,
    paddingTop: 2,
  },
  stepIconWrap: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineConnector: {
    width: 1.5,
    height: 14,
    marginVertical: 2,
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    paddingBottom: 6,
  },
  stepTextActive: {
    fontWeight: '600',
  },
});
