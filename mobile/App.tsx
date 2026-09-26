import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [serverUrl, setServerUrl] = useState('https://kito.rasppi.cloud');

  const checkHealth = async () => {
    setServerStatus('checking');
    try {
      // Tenta conexão com timeout de 3 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${serverUrl}/healthz`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        setServerStatus('online');
      } else {
        setServerStatus('offline');
      }
    } catch {
      setServerStatus('offline');
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brandTitle}>kito</Text>
        <Text style={styles.brandSubtitle}>Secretária Executiva com IA</Text>
      </View>

      {/* Status Card */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Servidor Raspberry Pi 4:</Text>
        <Text style={styles.cardUrl}>{serverUrl}</Text>

        <View style={styles.statusRow}>
          <View style={[styles.statusDot, serverStatus === 'online' ? styles.dotGreen : serverStatus === 'checking' ? styles.dotYellow : styles.dotRed]} />
          <Text style={styles.statusText}>
            {serverStatus === 'online' ? 'Conectado (Online)' : serverStatus === 'checking' ? 'Verificando conexão...' : 'Aguardando Servidor (Offline)'}
          </Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={checkHealth}>
          {serverStatus === 'checking' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>Testar Conexão</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Action Preview */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.voiceButton}>
          <Text style={styles.voiceIcon}>🎙️</Text>
          <Text style={styles.voiceText}>Pressione para falar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFBFA',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: 40,
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 42,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -1,
  },
  brandSubtitle: {
    fontSize: 16,
    color: '#666666',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444444',
  },
  cardUrl: {
    fontSize: 13,
    color: '#888888',
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  dotGreen: {
    backgroundColor: '#10B981',
  },
  dotYellow: {
    backgroundColor: '#F59E0B',
  },
  dotRed: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  button: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actionsContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  voiceButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  voiceIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  voiceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
});
