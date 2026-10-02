import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { tokens, MD3Shapes } from '../../theme/tokens';

export const UpdateBanner: React.FC = () => {
  const { isChecking, isDownloading, isUpdatePending, isUpdateAvailable } = Updates.useUpdates();

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
      {isDownloading && (
        <View style={[styles.banner, styles.bannerDownloading]}>
          <ActivityIndicator size="small" color={tokens.colors.onPrimaryContainer} />
          <Text style={[styles.text, styles.textDownloading]}>
            Baixando atualização do Vito...
          </Text>
        </View>
      )}

      {isUpdatePending && (
        <View style={[styles.banner, styles.bannerPending]}>
          <View style={styles.leftRow}>
            <MaterialIcons name="auto-awesome" size={18} color={tokens.colors.onTertiaryContainer} />
            <Text style={[styles.text, styles.textPending]}>
              Nova versão instalada!
            </Text>
          </View>
          <TouchableOpacity style={styles.restartBtn} onPress={handleReload} activeOpacity={0.8}>
            <Text style={styles.restartBtnText}>Reiniciar</Text>
          </TouchableOpacity>
        </View>
      )}

      {isUpdateAvailable && !isDownloading && !isUpdatePending && (
        <View style={[styles.banner, styles.bannerAvailable]}>
          <View style={styles.leftRow}>
            <MaterialIcons name="system-update" size={18} color={tokens.colors.onSecondaryContainer} />
            <Text style={[styles.text, styles.textAvailable]}>
              Atualização disponível
            </Text>
          </View>
          <TouchableOpacity style={styles.fetchBtn} onPress={handleFetch} activeOpacity={0.8}>
            <Text style={styles.fetchBtnText}>Baixar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    zIndex: 999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    gap: tokens.spacing.sm,
  },
  bannerDownloading: {
    backgroundColor: tokens.colors.primaryContainer,
    borderColor: tokens.colors.primary,
    justifyContent: 'center',
  },
  bannerPending: {
    backgroundColor: tokens.colors.tertiaryContainer,
    borderColor: tokens.colors.tertiary,
  },
  bannerAvailable: {
    backgroundColor: tokens.colors.secondaryContainer,
    borderColor: tokens.colors.secondary,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  text: {
    fontSize: tokens.typography.size.labelMedium,
    fontWeight: tokens.typography.weight.medium,
  },
  textDownloading: {
    color: tokens.colors.onPrimaryContainer,
  },
  textPending: {
    color: tokens.colors.onTertiaryContainer,
    fontWeight: tokens.typography.weight.bold,
  },
  textAvailable: {
    color: tokens.colors.onSecondaryContainer,
  },
  restartBtn: {
    backgroundColor: tokens.colors.onTertiaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: MD3Shapes.full,
  },
  restartBtnText: {
    color: tokens.colors.tertiaryContainer,
    fontSize: tokens.typography.size.labelSmall,
    fontWeight: tokens.typography.weight.bold,
  },
  fetchBtn: {
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: MD3Shapes.full,
  },
  fetchBtnText: {
    color: tokens.colors.onPrimary,
    fontSize: tokens.typography.size.labelSmall,
    fontWeight: tokens.typography.weight.bold,
  },
});
