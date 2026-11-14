import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { tokens } from '../../../theme/tokens';
import type { useByokSetup } from '../../../hooks/useByokSetup';
import { maskClientIdShort } from '../../../utils/pluggyKeys';
import { ErrorText, getFinTokens } from './byokUi';

type Setup = ReturnType<typeof useByokSetup>;

/** Atalho pós-configuração (`shortV` em Vito-telas-atualizadas.html). */
export const ByokShortcut: React.FC<{ setup: Setup }> = ({ setup: s }) => {
  const { colors, isDark } = useTheme();
  const { fin, finBg } = getFinTokens(colors, isDark);

  return (
    <View>
      <Text style={[styles.heading, { color: colors.ink }]}>Conectar bancos</Text>
      <Text style={[styles.sub, { color: colors.muted }]}>Suas chaves Pluggy já estão guardadas neste celular.</Text>

      <View style={styles.cards}>
        <TouchableOpacity
          style={[styles.card, { borderColor: colors.line, backgroundColor: colors.bg }]}
          onPress={s.openMeuPluggy}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Abrir Meu Pluggy"
        >
          <View style={[styles.chip, { backgroundColor: finBg }]}>
            <MaterialIcons name="open-in-new" size={20} color={fin} />
          </View>
          <View style={styles.cardBody}>
            <Text style={[styles.cardTitle, { color: colors.ink }]}>Abrir Meu Pluggy</Text>
            <Text style={[styles.cardMeta, { color: colors.muted }]}>Etapa 2 · conectar ou trocar bancos</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { borderColor: colors.line, backgroundColor: colors.bg }]}
          onPress={s.syncNow}
          disabled={s.busy}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Sincronizar no Vito"
        >
          <View style={[styles.chip, { backgroundColor: finBg }]}>
            {s.busy ? (
              <ActivityIndicator size="small" color={fin} />
            ) : (
              <MaterialIcons name="account-balance" size={20} color={fin} />
            )}
          </View>
          <View style={styles.cardBody}>
            <Text style={[styles.cardTitle, { color: colors.ink }]}>Sincronizar no Vito</Text>
            <Text style={[styles.cardMeta, { color: colors.muted }]}>Etapa 3 · um toque</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.kmeta}>
        <MaterialIcons name="lock-outline" size={15} color={colors.muted} />
        <Text style={[styles.kmetaText, { color: colors.muted }]}>
          Client ID {maskClientIdShort(s.clientId)} · validadas
        </Text>
      </View>

      <ErrorText message={s.error} />

      <View style={styles.links}>
        <TouchableOpacity onPress={s.changeKeys} style={styles.link} accessibilityRole="button">
          <Text style={[styles.linkText, { color: colors.muted }]}>Trocar chaves</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={s.showTutorial} style={styles.link} accessibilityRole="button">
          <Text style={[styles.linkText, { color: colors.muted }]}>Ver tutorial</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  heading: {
    fontSize: 28,
    lineHeight: 33,
    fontFamily: tokens.typography.family.montserratBold,
    letterSpacing: -0.6,
    marginTop: 18,
  },
  sub: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  cards: { marginTop: 22, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  chip: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 15.5, fontWeight: '600' },
  cardMeta: { fontSize: 12.5, marginTop: 2 },
  kmeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
  kmetaText: { fontSize: 13 },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  link: { height: 40, justifyContent: 'center' },
  linkText: { fontSize: 14, fontWeight: '600' },
});
