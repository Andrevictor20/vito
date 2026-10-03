import React, { useState, useMemo } from 'react';
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
import { useTheme } from '../context/ThemeContext';
import { isCloudServer } from '../services/api';
import { UpdateBanner } from '../components/common/UpdateBanner';
import { VitoLogo } from '../components/common/VitoLogo';
import { createAuthStyles } from './AuthScreen.styles';

interface AuthScreenProps {
  serverUrl?: string;
  onToggleServer?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ serverUrl, onToggleServer }) => {
  const { login, register, loginWithGoogle, isLoading } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => createAuthStyles(colors), [colors]);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      if (err?.message?.includes('cancelado')) {
        return;
      }
      setError(err?.message || 'Falha ao autenticar com o Google.');
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
        {/* Top Header M3 com Seletor de Servidor e Alternador de Tema */}
        <View style={styles.topHeaderRow}>
          <VitoLogo size="small" />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={styles.serverPill}
              onPress={toggleTheme}
              activeOpacity={0.75}
              accessibilityLabel={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            >
              <MaterialIcons
                name={isDark ? 'light-mode' : 'dark-mode'}
                size={14}
                color={colors.onSecondaryContainer}
              />
            </TouchableOpacity>

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
                  color={colors.onSecondaryContainer}
                />
                <Text style={styles.serverPillText}>
                  {isCloud ? 'Nuvem' : 'Local'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={styles.subtitle}>
          {isRegister ? 'Crie sua conta pessoal' : 'Seu secretário executivo pessoal com IA'}
        </Text>
        <Text style={styles.serverHostIndicator}>
          {isCloud ? 'Servidor: Nuvem (vito.rasppi.cloud)' : `Servidor: Local (${serverUrl || 'IP Local'})`}
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={16} color={colors.onErrorContainer} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {isRegister && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome Completo</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: André Silva"
              placeholderTextColor={colors.onSurfaceVariant}
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
            placeholderTextColor={colors.onSurfaceVariant}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Senha</Text>
          <View style={styles.passwordInputContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••••••"
              placeholderTextColor={colors.onSurfaceVariant}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.passwordEyeButton}
              onPress={() => setShowPassword((prev) => !prev)}
              activeOpacity={0.7}
              hitSlop={tokens.hitSlop.sm}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Ocultar senha' : 'Exibir senha'}
            >
              <MaterialIcons
                name={showPassword ? 'visibility-off' : 'visibility'}
                size={22}
                color={colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {isRegister ? 'Criar Conta' : 'Entrar'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Divisor Visual */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Botão de Autenticação com a Conta Google */}
        <TouchableOpacity
          style={[styles.googleButton, isLoading && styles.buttonDisabled]}
          onPress={handleGoogleLogin}
          disabled={isLoading}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Continuar com o Google"
        >
          <MaterialIcons name="account-circle" size={20} color={colors.primary} />
          <Text style={styles.googleButtonText}>Continuar com o Google</Text>
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
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <MaterialIcons name="sync" size={13} color={colors.onSurface} />
                <Text style={styles.checkUpdatesText}>Buscar update</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};
