import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { ChatWhatsAppMessage } from '../types';

interface WhatsAppInlineCardProps {
  card: ChatWhatsAppMessage;
  isSending: boolean;
  sent: boolean;
  onConfirm: () => void;
}

export const WhatsAppInlineCard: React.FC<WhatsAppInlineCardProps> = ({
  card,
  isSending,
  sent,
  onConfirm,
}) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.icon}>💬</Text>
          <Text style={styles.title}>WhatsApp</Text>
        </View>
        <Text style={styles.recipient}>
          {card.recipient_name || card.recipient_phone || 'Contato'}
        </Text>
      </View>
      <Text style={styles.message} numberOfLines={2}>
        "{card.message}"
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.confirmBtn, sent && styles.confirmBtnSuccess]}
          onPress={onConfirm}
          disabled={isSending || sent}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.confirmBtnText}>
              {sent ? 'Mensagem Aberta ✓' : 'Confirmar Envio'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E2025',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2E35',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 14,
    marginRight: 6,
  },
  title: {
    color: '#25D366',
    fontSize: 12,
    fontWeight: '700',
  },
  recipient: {
    color: '#E4E4E7',
    fontSize: 13,
    fontWeight: '600',
  },
  message: {
    color: '#A1A1AA',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  confirmBtn: {
    backgroundColor: '#25D366',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 14,
  },
  confirmBtnSuccess: {
    backgroundColor: '#10B981',
  },
  confirmBtnText: {
    color: '#000000',
    fontSize: 12.5,
    fontWeight: '700',
  },
});
