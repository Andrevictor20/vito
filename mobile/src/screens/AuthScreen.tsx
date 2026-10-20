import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { tokens } from '../theme/tokens';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { VitoLogo } from '../components/common/VitoLogo';
import { GoogleIcon } from '../components/common/GoogleIcon';
import { Button } from '../components/ui/Button';
import { TextInput } from '../components/ui/TextInput';
import { Card } from '../components/ui/Card';
import { WhatsAppAuthModal } from '../components/auth/WhatsAppAuthModal';
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
  const [showWhatsAppAuth, setShowWhatsAppAuth] = useState(false);

  const { currentlyRunning } = Updates.useUpdates();

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
        setError(`Falha ao conectar no servidor (${serverUrl || 'vito.rasppi.cloud'}). Verifique sua conexão com a internet.`);
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
      const msg = err?.message || '';
      // Só ignora silenciosamente se for explicitamente um cancelamento do usuário
      // (não erros de "falha ao abrir", "incompleta", etc. que contenham "cancelado" por coincidência)
      if (msg === 'Login com Google cancelado.' || msg === 'Login com Google já em andamento.') {
        return;
      }
      // Para erros de "Google Sign-in nativo não retornou token", mostra mensagem clara sobre SHA-1
      if (msg.includes('não retornou token de identificação') || msg.includes('Verifique a configuração do SHA-1')) {
        setError('Falha no login nativo do Google. Verifique se o app está assinado com a keystore correta e o SHA-1 está cadastrado no Google Cloud Console.');
        return;
      }
      // Para erros de backend rejeitando o token, mostra o erro real
      if (msg.includes('Falha no login com Google nativo:')) {
        setError(msg.replace('Falha no login com Google nativo: ', 'Erro do servidor: '));
        return;
      }
      // Para erros de configuração (DEVELOPER_ERROR, etc.) que caíram no fallback web mas falharam
      if (msg.includes('DEVELOPER_ERROR') || msg.includes('SIGN_IN_FAILED') || msg.includes('configuração do Google')) {
        setError('Configuração do Google Sign-In inválida. O SHA-1 do app não confere com o Google Cloud Console. Use o fallback web ou verifique a assinatura do APK.');
        return;
      }
      // Outros erros: mostra mensagem genérica mas informativa
      setError(msg || 'Falha ao autenticar com o Google. Tente novamente.');
    }
  };

  const handleManualCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      if (!Updates.isEnabled) {
        Alert.alert(
          'Atualizações OTA',
          'O serviço de atualizações OTA está desativado em ambiente de desenvolvimento (Metro). Ele opera ativamente em builds standalone instalados no dispositivo.'
        );
        return;
      }
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        Alert.alert(
          'Atualização Encontrada',
          'Baixando a versão mais recente em segundo plano...',
          [
            {
              text: 'Aplicar Agora',
              onPress: async () => {
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Aplicativo Atualizado',
          'Você já está executando a versão mais recente disponível para este aplicativo instalado.'
        );
      }
    } catch (e: any) {
      console.warn('[Updates] Erro ao verificar atualização:', e);
      Alert.alert(
        'Verificação de Atualização',
        `Não foi possível verificar atualizações: ${e?.message || 'Falha de conexão com os servidores do Expo'}.`
      );
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', width: '100%', alignItems: 'center' }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={{ width: '100%' }}
      >
        <Card variant="elevated" style={styles.card}>
        {/* Top Header M3 com Alternador de Tema */}
        <View style={styles.topHeaderRow}>
          <VitoLogo size="small" />

          <TouchableOpacity
            style={styles.themePill}
            onPress={toggleTheme}
            activeOpacity={0.75}
            accessibilityLabel={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          >
            <MaterialIcons
              name={isDark ? 'light-mode' : 'dark-mode'}
              size={16}
              color={colors.onSurface}
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          {isRegister ? 'Crie sua conta pessoal' : 'Seu secretário executivo pessoal com IA'}
        </Text>

        {!!error && (
          <View style={styles.errorBox}>
            <MaterialIcons name="error-outline" size={16} color={colors.onErrorContainer} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {isRegister && (
          <View style={styles.inputGroup}>
            <TextInput
              label="Nome Completo"
              placeholder="Ex: André Silva"
              value={name}
              onChangeText={setName}
              variant="outlined"
            />
          </View>
        )}

        <View style={styles.inputGroup}>
          <TextInput
            label="E-mail"
            placeholder="seu@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            variant="outlined"
          />
        </View>

        <View style={styles.inputGroup}>
          <View>
            <TextInput
              label="Senha"
              placeholder="Mínimo 6 caracteres"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              variant="outlined"
              style={{ paddingRight: 44 }}
            />
            <TouchableOpacity
              style={[styles.passwordEyeButton, { position: 'absolute', right: 4, top: 8 }]}
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

        <Button
          label={isRegister ? 'Criar Conta' : 'Entrar'}
          variant="filled"
          onPress={handleSubmit}
          isLoading={isLoading}
          style={{ marginTop: tokens.spacing.sm }}
        />

        {/* Divisor Visual */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Botão de Autenticação com a Conta Google */}
        <Button
          label="Continuar com o Google"
          variant="outlined"
          icon={<GoogleIcon size={18} />}
          onPress={handleGoogleLogin}
          isLoading={isLoading}
        />

        {/* Botão de Autenticação via WhatsApp (OTP sem senha) */}
        <Button
          label="Entrar com WhatsApp"
          variant="outlined"
          icon={<MaterialIcons name="chat" size={18} color="#25D366" />}
          onPress={() => setShowWhatsAppAuth(true)}
          style={{ marginTop: tokens.spacing.sm }}
        />

        <Button
          label={isRegister ? 'Já possui uma conta? Faça login' : 'Não tem conta? Cadastre-se em instantes'}
          variant="text"
          onPress={() => {
            setIsRegister(!isRegister);
            setError(null);
          }}
          style={{ marginTop: tokens.spacing.lg }}
        />

        {/* Rodapé com Versão OTA e Feedback Visual */}
        <View style={styles.otaFooterRow}>
          <Text style={styles.otaText}>
            Build: {currentlyRunning?.updateId ? `OTA ${currentlyRunning.updateId.slice(0, 7)}` : 'v0.1.3'}
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
      </Card>

      <WhatsAppAuthModal
        visible={showWhatsAppAuth}
        onClose={() => setShowWhatsAppAuth(false)}
      />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
