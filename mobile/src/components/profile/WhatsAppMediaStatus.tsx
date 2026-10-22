import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { WhatsAppMediaStatus } from '../../services/api/whatsappContextApi';

interface WhatsAppMediaStatusProps {
  /** Recarrega quando o restante da tela muda (ex.: após limpar o histórico). */
  refreshKey?: number;
}

/**
 * Bloco "MÍDIA DO HISTÓRICO": o Vito lê as imagens e áudios das mensagens que já
 * passaram. O worker de background processa aos poucos (custo) e este botão
 * dispara o processamento na hora.
 */
export const WhatsAppMediaStatusBlock: React.FC<WhatsAppMediaStatusProps> = ({ refreshKey }) => {
  const { colors } = useTheme();

  const [status, setStatus] = useState<WhatsAppMediaStatus | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.getWhatsAppMediaStatus();
      if (data) {
        setStatus(data);
      }
    } catch (err: any) {
      console.warn('[WhatsAppMediaStatus] Falha ao carregar o estado da mídia:', err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleProcess = async () => {
    setIsProcessing(true);
    try {
      const res = await api.processWhatsAppMedia(5);
      await load();
      const enriched = res?.enriched ?? 0;
      Alert.alert(
        enriched > 0 ? 'Mídia analisada' : 'Nada novo para analisar',
        enriched > 0
          ? `O Vito leu ${enriched} imagem(ns) ou áudio(s) do seu histórico.`
          : 'Todas as imagens e áudios do histórico já foram lidos.',
      );
    } catch (err: any) {
      Alert.alert('Não foi possível analisar', err?.message || 'Tente novamente em instantes.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!status) {
    return null;
  }

  const total = (status.done ?? 0) + (status.pending ?? 0) + (status.failed ?? 0);
  if (total === 0) {
    return (
      <View>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>MÍDIA DO HISTÓRICO</Text>
        <Text style={[styles.hint, { color: colors.onSurfaceVariant }]}>
          Nenhuma imagem ou áudio no histórico do WhatsApp.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>MÍDIA DO HISTÓRICO</Text>
      <View style={[styles.box, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
        <Text style={[styles.line, { color: colors.onSurface }]}>
          {status.done ?? 0} lida(s) pelo Vito
          {status.pending ? ` · ${status.pending} pendente(s)` : ''}
          {status.failed ? ` · ${status.failed} com falha` : ''}
        </Text>
        <Text style={[styles.hint, { color: colors.onSurfaceVariant }]}>
          Imagens e áudios que você mandou ficam disponíveis para o Vito ler quando você voltar
          a falar sobre eles.
        </Text>
        {status.pending ? (
          <TouchableOpacity
            style={[styles.button, { borderColor: colors.primary }]}
            onPress={handleProcess}
            disabled={isProcessing}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Analisar mídia pendente do WhatsApp"
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <MaterialIcons name="image-search" size={18} color={colors.primary} />
            )}
            <Text style={[styles.buttonText, { color: colors.primary }]}>Analisar agora</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: tokens.spacing.sm,
    marginTop: tokens.spacing.lg,
  },
  box: {
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  line: {
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
    minHeight: 44,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
