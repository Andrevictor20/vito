import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../../../context/ThemeContext';
import { BrandLogo } from '../../../../icons/IconRegistry';
import { MascotVectorRig } from '../../../bots/mascot/MascotVectorRig';
import type { AIProviderKey } from '../../../../types/aiProviders';

export interface AiProviderLogoProps {
  providerKey: AIProviderKey;
  size?: number;
}

const KNOWN_AI_LOGOS = new Set<string>([
  'srv',
  'anthropic',
  'google',
  'openai',
  'groq',
  'openrouter',
  'custom',
]);

export const AiProviderLogo: React.FC<AiProviderLogoProps> = ({
  providerKey,
  size = 36,
}) => {
  const { colors, isDark } = useTheme();
  if (providerKey === 'srv') {
    const radius = Math.round(size * 0.26);
    const rigSize = Math.round(size * 0.84);
    return (
      <View
        style={[
          styles.vitoServerBadge,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: isDark ? '#141416' : colors.bg,
            borderWidth: 1,
            borderColor: colors.line,
          },
        ]}
      >
        <MascotVectorRig
          size={rigSize}
          state="idle"
          animated={false}
          darkStage={isDark}
        />
      </View>
    );
  }
  const id = KNOWN_AI_LOGOS.has(providerKey) ? providerKey : 'custom';
  return <BrandLogo group="ai" id={id} size={size} />;
};

export interface AiProviderLogoStackProps {
  providerKeys: AIProviderKey[];
  size?: number;
  borderColor?: string;
}

export const AiProviderLogoStack: React.FC<AiProviderLogoStackProps> = ({
  providerKeys,
  size = 24,
  borderColor = '#FFFFFF',
}) => {
  const unique = Array.from(new Set(providerKeys)).slice(0, 4);
  if (unique.length === 0) unique.push('srv');
  return (
    <View style={styles.stackRow}>
      {unique.map((k, idx) => (
        <View
          key={k}
          style={[
            styles.stackItem,
            {
              width: size,
              height: size,
              borderRadius: size * 0.28,
              borderColor,
              marginLeft: idx === 0 ? 0 : -Math.round(size * 0.28),
              zIndex: unique.length - idx,
            },
          ]}
        >
          <AiProviderLogo providerKey={k} size={size - 2} />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  vitoServerBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  stackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackItem: {
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
