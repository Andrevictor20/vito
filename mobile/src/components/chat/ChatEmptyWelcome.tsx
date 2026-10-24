import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { VitoMascot } from '../common/VitoMascot';
import { ChatIdeasDeck } from './ChatIdeasDeck';

export interface ChatEmptyWelcomeProps {
  welcomeGreeting?: string;
  userName?: string;
  loading?: boolean;
  onSelectIdea?: (prompt: string) => void;
}

export const ChatEmptyWelcome: React.FC<ChatEmptyWelcomeProps> = ({
  welcomeGreeting,
  userName,
  loading = false,
  onSelectIdea,
}) => {
  const { colors } = useTheme();

  const titleText =
    welcomeGreeting ||
    (userName ? `Vamos lá, ${userName}! Como posso ajudar hoje?` : 'Como posso ajudar hoje?');

  return (
    <View style={styles.cheroContainer}>
      {/* Mascote Vito Hero */}
      <View style={styles.mascotWrapper}>
        <VitoMascot size={64} state={loading ? 'thinking' : 'idle'} animated={true} />
      </View>

      {/* Título H1 Montserrat 800 clamp */}
      <Text style={[styles.heroTitle, { color: colors.ink }]}>
        {titleText}
      </Text>

      {/* Subtítulo */}
      <Text style={[styles.heroSubtitle, { color: colors.muted }]}>
        Toque numa sugestão abaixo ou me diga o que precisa
      </Text>

      {/* Carrossel 3D de Ideias */}
      {onSelectIdea && (
        <ChatIdeasDeck
          onUseIdea={onSelectIdea}
          disabled={loading}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  cheroContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.xs,
  },
  mascotWrapper: {
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 23,
    fontFamily: tokens.typography.family.montserratBold,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginHorizontal: 12,
    marginTop: 6,
    lineHeight: 28,
  },
  heroSubtitle: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
    marginHorizontal: 20,
  },
});
