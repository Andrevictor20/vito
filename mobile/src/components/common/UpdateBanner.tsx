import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';

export const UpdateBanner: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { isChecking, isDownloading, isUpdatePending, isUpdateAvailable } = Updates.useUpdates();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (!isChecking && !isDownloading && !isUpdatePending && !isUpdateAvailable) {
    return null;
  }

  const handleReload = async () => {
    try {
      await Updates.reloadAsync();
    } catch (e) {
      console.warn('[Updates] Erro ao recarregar:', e);
    }
  };

  const handleFetch = async () => {
    try {
      await Updates.fetchUpdateAsync();
    } catch (e) {
      console.warn('[Updates] Erro ao baixar atualização:', e);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. Verificando atualizações */}
      {isChecking && !isDownloading && !isUpdatePending && !isUpdateAvailable && (
        <View style={[styles.pill, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.text, { color: colors.onSurface }]}>Buscando atualizações...</Text>
        </View>
      )}

      {/* 2. Baixando nova versão */}
      {isDownloading && (
        <View style={[styles.pill, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.primary }]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.text, { color: colors.onSurface, fontWeight: '600' }]}>
            Baixando atualização do Vito...
          </Text>
        </View>
      )}

      {/* 3. Atualização pronta para reiniciar */}
      {isUpdatePending && (
        <View style={[styles.pill, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]}>
          <View style={styles.leftRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? '#1E293B' : '#E0F2FE' }]}>
              <MaterialIcons name="auto-awesome" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.text, { color: colors.onSurface, fontWeight: '700' }]}>
              Nova versão pronta
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={handleReload}
            activeOpacity={0.8}
            accessibilityLabel="Reiniciar aplicativo para aplicar atualização"
          >
            <Text style={[styles.actionBtnText, { color: colors.onPrimary }]}>Reiniciar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 4. Atualização encontrada disponível */}
      {isUpdateAvailable && !isDownloading && !isUpdatePending && (
        <View style={[styles.pill, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]}>
          <View style={styles.leftRow}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? '#1E293B' : '#E0F2FE' }]}>
              <MaterialIcons name="system-update" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.text, { color: colors.onSurface }]}>
              Atualização disponível
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={handleFetch}
              activeOpacity={0.8}
              accessibilityLabel="Baixar nova versão"
            >
              <Text style={[styles.actionBtnText, { color: colors.onPrimary }]}>Baixar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDismissed(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Ignorar aviso"
            >
              <MaterialIcons name="close" size={16} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.xs,
    paddingBottom: tokens.spacing.xs,
    alignItems: 'center',
    zIndex: 999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
    minHeight: 44,
    maxWidth: 420,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    gap: 12,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: tokens.typography.size.labelMedium,
    fontWeight: tokens.typography.weight.medium,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: MD3Shapes.full,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
