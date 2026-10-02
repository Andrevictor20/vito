import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { tokens } from '../theme/tokens';
import { useAuth } from '../context/AuthContext';
import { isCloudServer } from '../services/api';
import { UpdateBanner } from '../components/common/UpdateBanner';
import { styles } from './AuthScreen.styles';

interface AuthScreenProps {
  serverUrl?: string;
  onToggleServer?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ serverUrl, onToggleServer }) => {
  const { login, register, isLoading } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  const { currentlyRunning } = Updates.useUpdates();
  const isCloud = isCloudServer(serverUrl || '');

  const handleSubmit = async () => {
    setError(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanEmail || !password || (isRegister && !cleanName)) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Informe um endereço de e-mail válido.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    try {
      if (isRegister) {
        await register(cleanName, cleanEmail, password);
      } else {
        await login(cleanEmail, password);
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (
        msg.includes('Network') ||
        msg.includes('fetch') ||
        msg.includes('Failed') ||
        msg.includes('esgotado') ||
        msg.includes('AbortError')
      ) {
        setError(`Falha ao conectar no servidor (${serverUrl || 'vito.rasppi.cloud'}). Toque no botão acima para alternar para a Nuvem.`);
      } else {
        setError(msg || 'Falha ao autenticar.');
      }
    }
  };

  const handleManualCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } else {
        setError(null);
      }
    } catch (e: any) {
      console.warn('[Updates] Erro ao verificar atualização:', e);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <UpdateBanner />

      <View style={styles.card}>
        {/* Top Header M3 com Seletor de Servidor */}
        <View style={styles.topHeaderRow}>
          <View style={styles.brandRow}>
            <Text style={styles.title}>vito</Text>
            <View style={styles.brandDot} />
          </View>

          {onToggleServer && (
            <TouchableOpacity
              style={styles.serverPill}
              onPress={onToggleServer}
              activeOpacity={0.75}
              accessibilityLabel="Alternar entre servidor nuvem e local"
            >
              <MaterialIcons
                name={isCloud ? 'cloud-done' : 'home'}
                size={14}
                color={tokens.colors.onSecondaryContainer}
              />
              <Text style={styles.serverPillText}>
                {isCloud ? 'Nuvem' : 'Local'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.subtitle}>
          {isRegister ? 'Crie sua conta pessoal' : 'Seu secretário executivo pessoal com IA'}
        </Text>
        <Text style={styles.serverHostIndicator}>
          {isCloud ? 'Servidor: Nuvem (vito.rasppi.cloud)' : `Servidor: Local (${serverUrl || 'IP Local'})`}
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={16} color={tokens.colors.onErrorContainer} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {isRegister && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome Completo</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: André Silva"
              placeholderTextColor={tokens.colors.onSurfaceVariant}
              value={name}
              onChangeText={setName}
            />
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="seu@email.com"
            placeholderTextColor={tokens.colors.onSurfaceVariant}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor={tokens.colors.onSurfaceVariant}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color={tokens.colors.onPrimary} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {isRegister ? 'Criar Conta' : 'Entrar'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => {
            setIsRegister(!isRegister);
            setError(null);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.switchText}>
            {isRegister
              ? 'Já possui uma conta? Faça login'
              : 'Não tem conta? Cadastre-se em instantes'}
          </Text>
        </TouchableOpacity>

        {/* Rodapé com Versão OTA e Feedback Visual */}
        <View style={styles.otaFooterRow}>
          <Text style={styles.otaText}>
            Build: {currentlyRunning?.updateId ? `OTA ${currentlyRunning.updateId.slice(0, 7)}` : 'v0.1.0'}
          </Text>

          <TouchableOpacity
            style={styles.checkUpdatesBtn}
            onPress={handleManualCheckUpdate}
            disabled={isCheckingUpdate}
            activeOpacity={0.75}
          >
            {isCheckingUpdate ? (
              <ActivityIndicator size="small" color={tokens.colors.primary} />
            ) : (
              <>
                <MaterialIcons name="sync" size={13} color={tokens.colors.onSurface} />
                <Text style={styles.checkUpdatesText}>Buscar update</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};
