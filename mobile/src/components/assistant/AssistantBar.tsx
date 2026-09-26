import React, { useState } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { tokens } from '../../theme/tokens';

interface AssistantBarProps {
  onSubmit: (prompt: string) => Promise<void>;
  isLoading: boolean;
}

export const AssistantBar: React.FC<AssistantBarProps> = ({ onSubmit, isLoading }) => {
  const [prompt, setPrompt] = useState('');

  const handleSend = async () => {
    if (!prompt.trim() || isLoading) return;
    const text = prompt.trim();
    setPrompt('');
    await onSubmit(text);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <TextInput
          style={styles.input}
          placeholder="Ex: Reunião com Pedro amanhã às 14h..."
          placeholderTextColor={tokens.colors.textMuted}
          value={prompt}
          onChangeText={setPrompt}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          editable={!isLoading}
        />

        <TouchableOpacity
          style={[styles.sendButton, (!prompt.trim() || isLoading) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!prompt.trim() || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendIcon}>✨</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    backgroundColor: tokens.colors.bg,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.surfaceBorder,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    borderRadius: tokens.radii.full,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
  },
  input: {
    flex: 1,
    height: 42,
    color: tokens.colors.textPrimary,
    fontSize: 14,
    paddingHorizontal: tokens.spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: tokens.colors.surfaceBorder,
    opacity: 0.6,
  },
  sendIcon: {
    fontSize: 16,
  },
});
