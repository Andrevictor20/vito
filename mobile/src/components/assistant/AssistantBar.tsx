import React, { useState, useRef } from 'react';
import { StyleSheet, View, TextInput, TouchableOpacity, Text, ActivityIndicator, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { tokens } from '../../theme/tokens';

interface AssistantBarProps {
  onSubmit: (prompt: string) => Promise<void>;
  onAudioSubmit?: (audioUri: string) => Promise<void>;
  isLoading: boolean;
}

export const AssistantBar: React.FC<AssistantBarProps> = ({ onSubmit, onAudioSubmit, isLoading }) => {
  const [prompt, setPrompt] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const handleSend = async () => {
    if (!prompt.trim() || isLoading) return;
    const text = prompt.trim();
    setPrompt('');
    await onSubmit(text);
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Microfone necessário', 'Conceda permissão de acesso ao microfone nas configurações para usar comandos por voz.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (err: any) {
      console.error('Falha ao iniciar gravação:', err);
      Alert.alert('Erro ao gravar', 'Não foi possível iniciar a captura de áudio.');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    try {
      setIsRecording(false);
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (uri && onAudioSubmit) {
        await onAudioSubmit(uri);
      }
    } catch (err: any) {
      console.error('Falha ao parar gravação:', err);
      Alert.alert('Erro no áudio', 'Houve uma falha ao finalizar a gravação.');
    }
  };

  const handleMicPress = () => {
    if (isLoading) return;
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const hasText = prompt.trim().length > 0;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, isRecording && styles.containerRecording]}>
        <TextInput
          style={styles.input}
          placeholder={
            isRecording
              ? 'Gravando... Toque no botão para enviar'
              : 'Fale ou digite (ex: Consulta amanhã às 15h)...'
          }
          placeholderTextColor={isRecording ? tokens.colors.danger : tokens.colors.textMuted}
          value={prompt}
          onChangeText={setPrompt}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          editable={!isLoading && !isRecording}
        />

        {hasText ? (
          <TouchableOpacity
            style={[styles.actionButton, isLoading && styles.buttonDisabled]}
            onPress={handleSend}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionIcon}>✨</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.actionButton,
              isRecording ? styles.micButtonRecording : styles.micButtonIdle,
              isLoading && styles.buttonDisabled,
            ]}
            onPress={handleMicPress}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionIcon}>{isRecording ? '⏹️' : '🎙️'}</Text>
            )}
          </TouchableOpacity>
        )}
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
  containerRecording: {
    borderColor: tokens.colors.danger,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  input: {
    flex: 1,
    height: 42,
    color: tokens.colors.textPrimary,
    fontSize: 14,
    paddingHorizontal: tokens.spacing.sm,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonIdle: {
    backgroundColor: tokens.colors.primary,
  },
  micButtonRecording: {
    backgroundColor: tokens.colors.danger,
  },
  buttonDisabled: {
    backgroundColor: tokens.colors.surfaceBorder,
    opacity: 0.6,
  },
  actionIcon: {
    fontSize: 16,
  },
});
