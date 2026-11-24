import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ProtoUiIcon } from '../../icons/ProtoUiIcons';
import { useTheme } from '../../context/ThemeContext';
import { tokens } from '../../theme/tokens';
import type { AIProviderKey, UserAIProvider } from '../../types/aiProviders';
import { summarizeOwnProviders } from '../../services/ai/aiProviderCatalog';
import { AiProviderLogoStack } from '../ai/AiProviderLogo';

export interface AiSectionProps {
  providers: UserAIProvider[];
  defaultModelName: string;
  onPressProviders: () => void;
  onPressDefaultModel: () => void;
}

export const AiSection: React.FC<AiSectionProps> = ({
  providers,
  defaultModelName,
  onPressProviders,
  onPressDefaultModel,
}) => {
  const { colors } = useTheme();
  const activeKeys: AIProviderKey[] = (providers || [])
    .filter((p) => p.status === 'ok')
    .map((p) => p.provider_key);
  const providersSummary = summarizeOwnProviders(providers);

  return (
    <>
      <Text style={[styles.lbl, { color: colors.muted }]}>Inteligência artificial</Text>
      <View style={[styles.lst, { backgroundColor: colors.surf, borderColor: colors.hairline }]}>
        <TouchableOpacity
          style={styles.li}
          onPress={onPressProviders}
          activeOpacity={0.7}
          accessibilityLabel="Provedores de IA"
        >
          <View style={styles.stackBox}>
            <AiProviderLogoStack providerKeys={activeKeys} borderColor={colors.surf} />
          </View>
          <View style={styles.textCol}>
            <Text style={[styles.liTitle, { color: colors.ink }]}>Provedores de IA</Text>
            <Text style={[styles.liSub, { color: colors.muted }]} numberOfLines={1}>
              {providersSummary}
            </Text>
          </View>
          <ProtoUiIcon name="chevron-right" size={18} color={colors.muted} />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

        <TouchableOpacity
          style={styles.li}
          onPress={onPressDefaultModel}
          activeOpacity={0.7}
          accessibilityLabel="Modelo padrão"
        >
          <View style={[styles.liIconBox, { backgroundColor: colors.bg }]}>
            <ProtoUiIcon name="memory" size={18} color={colors.ink} />
          </View>
          <View style={styles.textCol}>
            <Text style={[styles.liTitle, { color: colors.ink }]}>Modelo padrão</Text>
            <Text style={[styles.liSub, { color: colors.muted }]} numberOfLines={1}>
              {defaultModelName || 'Vito Auto'}
            </Text>
          </View>
          <ProtoUiIcon name="chevron-right" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  lbl: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0,
    marginTop: 22,
    marginBottom: 8,
    marginHorizontal: 2,
  },
  lst: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 6,
  },
  li: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 58,
  },
  stackBox: {
    minWidth: 34,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  liIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1 },
  liTitle: {
    fontSize: 14.5,
    fontWeight: '500',
    fontFamily: tokens.typography.family.medium,
  },
  liSub: {
    fontSize: 12.5,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginLeft: 60,
  },
});
