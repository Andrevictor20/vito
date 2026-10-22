import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { syncSavedContactNames } from '../../services/whatsappContactNames';

interface WhatsAppContactNamesImportProps {
  /** Avisa o pai quantos nomes foram enviados (para recarregar o diretório). */
  onImported?: (count: number) => void;
}

/**
 * Botão "Importar nomes dos contatos".
 *
 * O Vito reconhece o contato pelo nome que o DONO deu a ele ("isa"), não pelo
 * nome de perfil que a pessoa escolheu no WhatsApp ("bella"). Esse nome salvo
 * vive na agenda do celular — o app é a via de levá-lo até o servidor (que é o
 * servidor do próprio usuário).
 */
export const WhatsAppContactNamesImport: React.FC<WhatsAppContactNamesImportProps> = ({
  onImported,
}) => {
  const { colors } = useTheme();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncSavedContactNames();
      if (result.permissionDenied) {
        Alert.alert(
          'Permissão necessária',
          'O Vito precisa da sua agenda para reconhecer os contatos como você os salvou. Ative a permissão de Contatos nas configurações do celular.',
        );
        return;
      }
      if (result.usable === 0) {
        Alert.alert('Nada para importar', 'Nenhum contato da sua agenda tem nome e telefone.');
        return;
      }
      onImported?.(result.sent);
      Alert.alert(
        'Nomes importados',
        `${result.sent} contato(s) reconhecido(s) pelo nome que você salvou. Agora o Vito entende "a Isa" também.`,
      );
    } catch (err: any) {
      Alert.alert('Não foi possível importar', err?.message || 'Tente novamente em instantes.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>NOMES DOS CONTATOS</Text>
      <View style={[styles.box, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
        <Text style={[styles.hint, { color: colors.onSurfaceVariant }]}>
          O Vito reconhece seus contatos pelo nome que você salvou no WhatsApp. Ele lê a agenda do
          celular para isso — os nomes vão apenas para o seu servidor.
        </Text>
        <TouchableOpacity
          style={[styles.button, { borderColor: colors.primary }]}
          onPress={handleSync}
          disabled={isSyncing}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Importar nomes dos contatos do celular"
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MaterialIcons name="contacts" size={18} color={colors.primary} />
          )}
          <Text style={[styles.buttonText, { color: colors.primary }]}>Importar nomes</Text>
        </TouchableOpacity>
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
