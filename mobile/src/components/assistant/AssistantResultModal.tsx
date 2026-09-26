import React from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity } from 'react-native';
import { tokens } from '../../theme/tokens';
import { AssistantChatResponse } from '../../types';

interface AssistantResultModalProps {
  visible: boolean;
  result: AssistantChatResponse | null;
  onClose: () => void;
}

export const AssistantResultModal: React.FC<AssistantResultModalProps> = ({
  visible,
  result,
  onClose,
}) => {
  if (!result) return null;

  const hasConflict = result.conflict && result.conflict.has_conflict;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.assistantIcon}>🤖</Text>
            <Text style={styles.title}>Vito Secretário</Text>
          </View>

          {/* Reply message */}
          <Text style={styles.replyText}>{result.reply}</Text>

          {/* Conflict Warning */}
          {hasConflict && (
            <View style={styles.conflictBox}>
              <Text style={styles.conflictTitle}>⚠️ Conflito de Horário Detectado!</Text>
              <Text style={styles.conflictMessage}>{result.conflict?.message}</Text>
            </View>
          )}

          {/* Event Preview */}
          {result.event && (
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>📅 Compromisso:</Text>
              <Text style={styles.previewTitle}>{result.event.title}</Text>
              <Text style={styles.previewSub}>
                {new Date(result.event.start_at).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                -{' '}
                {new Date(result.event.end_at).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          )}

          {/* Todo Preview */}
          {result.todo && (
            <View style={styles.previewBox}>
              <Text style={styles.previewLabel}>✅ Tarefa Criada:</Text>
              <Text style={styles.previewTitle}>{result.todo.title}</Text>
              <Text style={styles.previewSub}>Prioridade: {result.todo.priority.toUpperCase()}</Text>
            </View>
          )}

          {/* Action button */}
          <TouchableOpacity style={styles.confirmButton} onPress={onClose}>
            <Text style={styles.confirmText}>Entendido</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: tokens.spacing.md,
  },
  assistantIcon: {
    fontSize: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.colors.textPrimary,
  },
  replyText: {
    fontSize: 14,
    color: tokens.colors.textSecondary,
    lineHeight: 20,
    marginBottom: tokens.spacing.md,
  },
  conflictBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: tokens.colors.warning,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  conflictTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.warning,
  },
  conflictMessage: {
    fontSize: 12,
    color: tokens.colors.textPrimary,
    marginTop: 4,
  },
  previewBox: {
    backgroundColor: tokens.colors.surfaceSubtle,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: tokens.colors.primary,
  },
  previewLabel: {
    fontSize: 11,
    color: tokens.colors.textMuted,
    fontWeight: '600',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: tokens.colors.textPrimary,
    marginTop: 2,
  },
  previewSub: {
    fontSize: 12,
    color: tokens.colors.accent,
    marginTop: 2,
  },
  confirmButton: {
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
    marginTop: tokens.spacing.sm,
  },
  confirmText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
