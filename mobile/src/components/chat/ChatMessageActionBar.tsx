import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Share } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { copyToClipboard } from '../../utils/clipboard';
import { preparePlainTextForCopy } from '../../utils/chatActions';
import { hapticFeedback } from '../../theme/motion';

export interface ChatMessageActionBarProps {
  messageText: string;
  timestamp: string;
  onPlayAudio?: () => void;
  isPlayingAudio?: boolean;
  disabled?: boolean;
}

export const ChatMessageActionBar: React.FC<ChatMessageActionBarProps> = ({
  messageText,
  timestamp,
  onPlayAudio,
  isPlayingAudio = false,
  disabled = false,
}) => {
  const { colors, isDark } = useTheme();
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);

  const handleCopy = async () => {
    hapticFeedback.light();
    const textToCopy = preparePlainTextForCopy(messageText);
    const ok = await copyToClipboard(textToCopy);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    hapticFeedback.light();
    try {
      const textToShare = preparePlainTextForCopy(messageText);
      await Share.share({ message: textToShare });
    } catch (e) {
      // Ignora cancelamento de compartilhamento
    }
  };

  const handleFeedback = (type: 'like' | 'dislike') => {
    hapticFeedback.selection();
    setFeedback((prev) => (prev === type ? null : type));
  };

  const iconColor = colors.onSurfaceVariant;
  const activeColor = isDark ? '#A7F3D0' : '#065F46';
  const formattedTime = new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.actionBar}>
      <View style={styles.actionGroup}>
        {/* Copiar */}
        <TouchableOpacity
          style={[styles.iconButton, copied && styles.iconButtonActive]}
          onPress={handleCopy}
          hitSlop={tokens.hitSlop.sm}
          activeOpacity={0.6}
          accessibilityLabel="Copiar mensagem"
          disabled={disabled}
        >
          <MaterialIcons
            name={copied ? 'check' : 'content-copy'}
            size={15}
            color={copied ? '#10B981' : iconColor}
          />
          {copied && (
            <Text style={[styles.microLabel, { color: '#10B981' }]}>Copiado</Text>
          )}
        </TouchableOpacity>

        {/* Ouvir Áudio (Text-to-Speech) */}
        {onPlayAudio && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              hapticFeedback.selection();
              onPlayAudio();
            }}
            hitSlop={tokens.hitSlop.sm}
            activeOpacity={0.6}
            accessibilityLabel="Ouvir resposta em áudio"
            disabled={disabled}
          >
            <MaterialIcons
              name={isPlayingAudio ? 'volume-up' : 'volume-mute'}
              size={16}
              color={isPlayingAudio ? activeColor : iconColor}
            />
          </TouchableOpacity>
        )}

        {/* Feedback Positivo (Like) */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => handleFeedback('like')}
          hitSlop={tokens.hitSlop.sm}
          activeOpacity={0.6}
          accessibilityLabel="Gostei da resposta"
          disabled={disabled}
        >
          <MaterialIcons
            name={feedback === 'like' ? 'thumb-up' : 'thumb-up-off-alt'}
            size={15}
            color={feedback === 'like' ? activeColor : iconColor}
          />
        </TouchableOpacity>

        {/* Feedback Negativo (Dislike) */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => handleFeedback('dislike')}
          hitSlop={tokens.hitSlop.sm}
          activeOpacity={0.6}
          accessibilityLabel="Não gostei da resposta"
          disabled={disabled}
        >
          <MaterialIcons
            name={feedback === 'dislike' ? 'thumb-down' : 'thumb-down-off-alt'}
            size={15}
            color={feedback === 'dislike' ? '#EF4444' : iconColor}
          />
        </TouchableOpacity>

        {/* Compartilhar */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleShare}
          hitSlop={tokens.hitSlop.sm}
          activeOpacity={0.6}
          accessibilityLabel="Compartilhar resposta"
          disabled={disabled}
        >
          <MaterialIcons name="share" size={15} color={iconColor} />
        </TouchableOpacity>
      </View>

      {/* Timestamp Discreto */}
      <Text style={[styles.timestamp, { color: iconColor }]}>
        {formattedTime}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 4,
    width: '100%',
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    opacity: 0.72,
  },
  iconButtonActive: {
    opacity: 1,
    gap: 4,
  },
  microLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  timestamp: {
    fontSize: 11,
    opacity: 0.55,
  },
});
