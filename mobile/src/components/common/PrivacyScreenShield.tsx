import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, AppState, AppStateStatus, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { shouldShowPrivacyShield } from '../../utils/privacyShield';

/**
 * Escudo de Privacidade do SO (Sprint 14):
 * Invisível durante o uso normal (foreground), mas cobre imediatamente a árvore visual
 * quando o aplicativo entra em 'inactive' ou 'background', impedindo que o gerenciador
 * de multitarefas do Android/iOS capture snapshots de conversas, agenda ou tarefas.
 */
export const PrivacyScreenShield: React.FC = () => {
  const [shieldActive, setShieldActive] = useState<boolean>(() =>
    shouldShowPrivacyShield(AppState.currentState || 'active', Platform.OS)
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      setShieldActive(shouldShowPrivacyShield(nextState, Platform.OS));
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  if (!shieldActive) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="none" accessibilityElementsHidden>
      <View style={styles.lockBadge}>
        <MaterialIcons name="lock-outline" size={28} color="#A1A1AA" />
      </View>
      <Text style={styles.brandTitle}>Vito</Text>
      <Text style={styles.brandSub}>Conteúdo protegido em segundo plano</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#0B0D10',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    elevation: 99999,
    gap: 8,
  },
  lockBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#14171C',
    borderWidth: 1,
    borderColor: '#262B33',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FAFAFA',
    letterSpacing: -0.4,
  },
  brandSub: {
    fontSize: 13,
    color: '#71717A',
  },
});
