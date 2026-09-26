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
import { tokens } from '../theme/tokens';
import { useAuth } from '../context/AuthContext';
import { styles } from './AuthScreen.styles';

export const AuthScreen: React.FC = () => {
  const { login, register, isLoading } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!email || !password || (isRegister && !name)) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }

    try {
      if (isRegister) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao autenticar.');
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    const demoEmail = 'andre@vito.local';
    const demoPass = 'segredo123';
    try {
      await login(demoEmail, demoPass);
    } catch {
      // Se não existir, tenta registrar
      try {
        await register('André', demoEmail, demoPass);
      } catch (err: any) {
        setError(err?.message || 'Falha ao acessar modo demo.');
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.card}>
        <View style={styles.brandRow}>
          <Text style={styles.title}>vito</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>AI</Text>
          </View>
        </View>

        <Text style={styles.subtitle}>
          {isRegister ? 'Crie sua conta pessoal' : 'Seu secretário executivo pessoal'}
        </Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {isRegister && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome Completo</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: André Silva"
              placeholderTextColor={tokens.colors.textMuted}
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
            placeholderTextColor={tokens.colors.textMuted}
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
            placeholderTextColor={tokens.colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {isRegister ? 'Criar Conta' : 'Entrar'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.demoButton}
          onPress={handleDemoLogin}
          disabled={isLoading}
        >
          <Text style={styles.demoButtonText}>⚡ Entrar com 1 Toque (Demo)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => {
            setIsRegister(!isRegister);
            setError(null);
          }}
        >
          <Text style={styles.switchText}>
            {isRegister
              ? 'Já possui uma conta? Faça login'
              : 'Não tem conta? Cadastre-se em 10 segundos'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};
