import React from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';

interface ChatInputDockProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  loading?: boolean;
  onPressMic?: () => void;
  isRecording?: boolean;
  onPressAttach?: () => void;
}

export const ChatInputDock: React.FC<ChatInputDockProps> = ({
  value,
  onChangeText,
  onSend,
  loading = false,
  onPressMic,
  isRecording = false,
  onPressAttach,
}) => {
  const canSend = value.trim().length > 0 && !loading;

  return (
    <View style={styles.dockWrapper}>
      <View style={styles.capsule}>
        {/* Botão de Ditado / Microfone */}
        <TouchableOpacity
          style={[styles.iconButton, isRecording && styles.micButtonRecording]}
          onPress={onPressMic}
          activeOpacity={0.7}
          hitSlop={tokens.hitSlop.sm}
          accessibilityLabel={isRecording ? 'Parar gravação' : 'Gravar áudio'}
        >
          <MaterialIcons
            name={isRecording ? 'stop' : 'mic'}
            size={20}
            color={isRecording ? '#ffffff' : tokens.colors.textSecondary}
          />
        </TouchableOpacity>

        {/* Campo de Entrada de Texto */}
        <TextInput
          style={styles.input}
          placeholder={isRecording ? 'Ouvindo... Toque no botão para concluir' : 'Instrua o Vito ou pergunte algo...'}
          placeholderTextColor={isRecording ? tokens.colors.danger : tokens.colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          multiline
          maxLength={1000}
          blurOnSubmit={false}
          returnKeyType="default"
        />

        {/* Botão de Anexo / Contexto */}
        {onPressAttach && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onPressAttach}
            activeOpacity={0.7}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel="Anexar contexto"
          >
            <MaterialIcons name="add-circle" size={20} color={tokens.colors.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Botão Primário de Envio (Cobalt Circle) */}
        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={onSend}
          disabled={!canSend}
          activeOpacity={0.8}
          accessibilityLabel="Enviar mensagem"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons name="arrow-upward" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  dockWrapper: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs + 2,
    backgroundColor: 'transparent',
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceContainerHigh,
    borderRadius: tokens.radii.full,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    gap: 4,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: tokens.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonRecording: {
    backgroundColor: tokens.colors.danger,
  },
  input: {
    flex: 1,
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.size.sm + 1,
    lineHeight: tokens.typography.lineHeight.md,
    paddingHorizontal: tokens.spacing.xs,
    paddingVertical: 6,
    maxHeight: 90,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.cobalt,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: tokens.colors.cobalt,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: tokens.colors.surfaceContainerHighest,
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
});
