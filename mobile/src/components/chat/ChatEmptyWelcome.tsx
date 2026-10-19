import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { VitoMascot } from '../common/VitoMascot';

export interface ChatEmptyWelcomeProps {
  welcomeGreeting: string;
  loading?: boolean;
}

export const ChatEmptyWelcome: React.FC<ChatEmptyWelcomeProps> = ({
  welcomeGreeting,
  loading = false,
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.emptyWelcomeContainer}>
      <View style={styles.emptyMascotWrapper}>
        <VitoMascot size={72} state={loading ? 'thinking' : 'idle'} animated={true} />
      </View>
      <Text style={[styles.emptyWelcomeTitle, { color: colors.onSurface }]}>
        {welcomeGreeting}
      </Text>
      <Text style={[styles.emptyWelcomeSubtitle, { color: colors.onSurfaceVariant }]}>
        Toque numa sugestão abaixo ou me diga o que precisa
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  emptyWelcomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.xl,
  },
  emptyMascotWrapper: {
    marginBottom: tokens.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWelcomeTitle: {
    fontSize: tokens.typography.size.headlineSmall,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: tokens.spacing.xs,
  },
  emptyWelcomeSubtitle: {
    fontSize: tokens.typography.size.bodyMedium,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
});
