import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ProtoUiIcon } from '../../../../icons/ProtoUiIcons';
import { BottomSheetModal } from '../../../../components/ui/BottomSheetModal';
import { useTheme } from '../../../../context/ThemeContext';
import { tokens } from '../../../../theme/tokens';
import { api } from '../../../../services/api';
import { AI_PROVIDER_CATALOG, getProviderSheetMode } from '../../../../services/ai/aiProviderCatalog';
import { validateProviderCredentials } from '../../../../services/ai/aiProviderValidation';
import type { UserAIProvider } from '../../../../types/aiProviders';
import { AiProviderLogo } from './AiProviderLogo';

export { getProviderSheetMode };

export interface AiProviderSheetProps {
  visible: boolean;
  provider: UserAIProvider | null;
  onClose: () => void;
  onUpdated: (updated?: UserAIProvider, message?: string) => void;
}

export const AiProviderSheet: React.FC<AiProviderSheetProps> = ({
  visible,
  provider,
  onClose,
  onUpdated,
}) => {
  const { colors } = useTheme();
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testLabel, setTestLabel] = useState('Testar chave');
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    setApiKeyInput('');
    setBaseUrlInput(provider?.base_url || '');
    setErrorMsg('');
    setSaving(false);
    setTesting(false);
    setTestLabel('Testar chave');
    setRemoving(false);
  }, [visible, provider?.provider_key]);

  if (!provider) return null;

  const entry = AI_PROVIDER_CATALOG[provider.provider_key];
  const mode = getProviderSheetMode(provider);
  const models = provider.models?.length ? provider.models : entry.defaultModels;

  const handleSave = async () => {
    const check = validateProviderCredentials(provider.provider_key, apiKeyInput, baseUrlInput);
    if (!check.valid) {
      setErrorMsg(check.error || 'Preencha a chave.');
      return;
    }

    setErrorMsg('');
    setSaving(true);
    const submittedKey = apiKeyInput.trim();
    const submittedUrl = entry.requiresUrl ? baseUrlInput.trim() : undefined;
    setApiKeyInput('');

    try {
      const updated = await api.aiProviders.connectProvider(provider.provider_key, {
        api_key: submittedKey,
        ...(submittedUrl ? { base_url: submittedUrl } : {}),
      });
      onUpdated(updated, `${entry.name} conectado`);
    } catch (err: any) {
      const status = err?.status;
      if (status === 401 || status === 403) {
        setErrorMsg(`O ${entry.name} recusou esta chave. Confira se ela está ativa.`);
      } else {
        setErrorMsg(err?.message || `O ${entry.name} recusou esta chave. Confira se ela está ativa.`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (testing || removing) return;
    setTesting(true);
    setTestLabel('Testando…');
    setErrorMsg('');
    try {
      const res = await api.aiProviders.testProvider(provider.provider_key);
      if (res.status === 'ok' || res.valid) {
        setTestLabel('Chave válida ✓');
        onUpdated(undefined, `${entry.name}: chave válida`);
      } else {
        setTestLabel('Testar chave');
        setErrorMsg(res.error || `O ${entry.name} recusou esta chave. Confira se ela está ativa.`);
      }
    } catch (err: any) {
      setTestLabel('Testar chave');
      setErrorMsg(err?.message || `Falha ao testar chave do ${entry.name}.`);
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    if (removing || testing) return;
    setRemoving(true);
    setErrorMsg('');
    try {
      await api.aiProviders.removeProvider(provider.provider_key);
      onClose();
      onUpdated(undefined, `${entry.name} removido`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Não foi possível remover a chave.');
    } finally {
      setRemoving(false);
    }
  };

  const maskText = provider.key_last4 ? `••••${provider.key_last4}` : '••••';
  const subtitle =
    mode === 'srv'
      ? `${entry.company} · sem chave`
      : mode === 'connected'
        ? `${provider.status === 'invalid' ? 'Chave recusada' : 'Conectado'} · chave ${maskText}`
        : entry.company;

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={entry.name} subtitle={subtitle}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.heroRow}>
          <AiProviderLogo providerKey={provider.provider_key} size={46} />
          <View style={styles.heroTextWrap}>
            <Text style={[styles.heroTitle, { color: colors.ink }]}>{entry.name}</Text>
            <Text style={[styles.heroSub, { color: colors.muted }]}>{subtitle}</Text>
          </View>
        </View>

        {mode === 'srv' && (
          <View style={[styles.card, { backgroundColor: colors.surf, borderColor: colors.line }]}>
            <Text style={[styles.bodyText, { color: colors.ink }]}>{entry.helpText}</Text>
          </View>
        )}

        {mode === 'connected' && (
          <>
            <View style={[styles.card, { backgroundColor: colors.surf, borderColor: colors.line }]}>
              <View style={styles.infoRow}>
                <ProtoUiIcon name="vpn-key" size={18} color={colors.ink} />
                <View style={styles.infoCol}>
                  <Text style={[styles.infoTitle, { color: colors.ink }]}>Chave {maskText}</Text>
                  <Text style={[styles.infoSub, { color: colors.muted }]}>
                    {provider.status === 'invalid'
                      ? 'Chave marcada como inválida — substitua ou remova'
                      : 'Verificada agora · criptografada no servidor'}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.muted }]}>MODELOS DISPONÍVEIS</Text>
            <View style={[styles.card, { backgroundColor: colors.surf, borderColor: colors.line }]}>
              {models.map((m, idx) => (
                <View
                  key={m.id}
                  style={[
                    styles.modelRow,
                    idx > 0 && { borderTopWidth: 1, borderTopColor: colors.line },
                  ]}
                >
                  <ProtoUiIcon name="memory" size={17} color={colors.muted} />
                  <View style={styles.infoCol}>
                    <Text style={[styles.infoTitle, { color: colors.ink }]}>{m.name}</Text>
                    <Text style={[styles.infoSub, { color: colors.muted }]}>
                      {(m.note || 'Modelo disponível') + (m.reasoning ? ' · raciocínio' : '')}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {!!errorMsg && (
              <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.red }]}>
                {errorMsg}
              </Text>
            )}

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.surf, borderColor: colors.line }]}
                onPress={handleTest}
                disabled={testing || removing}
                activeOpacity={0.75}
              >
                <Text style={[styles.btnText, { color: colors.ink }]}>{testLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.redBg, borderColor: colors.red }]}
                onPress={handleRemove}
                disabled={testing || removing}
                activeOpacity={0.75}
              >
                <Text style={[styles.btnText, { color: colors.red }]}>
                  {removing ? 'Removendo…' : 'Remover chave'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {mode === 'unconnected' && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>
              {entry.requiresUrl ? 'ENDEREÇO E CHAVE' : 'CHAVE DE API'}
            </Text>
            {entry.requiresUrl && (
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.surf, borderColor: colors.line, color: colors.ink },
                ]}
                placeholder="https://seu-endpoint.com/v1"
                placeholderTextColor={colors.muted}
                value={baseUrlInput}
                onChangeText={setBaseUrlInput}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                keyboardType="url"
                accessibilityLabel="Endereço do endpoint compatível"
              />
            )}
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.surf, borderColor: colors.line, color: colors.ink },
              ]}
              placeholder={entry.placeholder}
              placeholderTextColor={colors.muted}
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              accessibilityLabel="Chave de API"
            />
            {!!errorMsg && (
              <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.red }]}>
                {errorMsg}
              </Text>
            )}
            <Text style={[styles.helpText, { color: colors.muted }]}>{entry.helpText}</Text>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.ink, opacity: saving ? 0.7 : 1 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.bg} />
              ) : (
                <Text style={[styles.primaryBtnText, { color: colors.bg }]}>
                  Salvar e verificar
                </Text>
              )}
              {saving && (
                <Text style={[styles.primaryBtnText, { color: colors.bg, marginLeft: 8 }]}>
                  Verificando…
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  heroTextWrap: { flex: 1 },
  heroTitle: { fontSize: 17, fontWeight: '600', fontFamily: tokens.typography.family.semibold },
  heroSub: { fontSize: 13, marginTop: 2 },
  card: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  bodyText: { fontSize: 14, lineHeight: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  modelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  infoCol: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: '600' },
  infoSub: { fontSize: 12.5, marginTop: 2 },
  sectionLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.7, marginTop: 16, marginBottom: 8 },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14.5,
    marginBottom: 10,
  },
  errorText: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
  helpText: { fontSize: 12.5, lineHeight: 18, marginBottom: 14 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnText: { fontSize: 14, fontWeight: '600' },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnText: { fontSize: 14.5, fontWeight: '600' },
});
