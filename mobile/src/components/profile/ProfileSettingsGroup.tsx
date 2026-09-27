import React, { useState } from 'react';
import { StyleSheet, View, Text, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';

export const ProfileSettingsGroup: React.FC = () => {
  const [whisperEnabled, setWhisperEnabled] = useState(true);

  return (
    <View style={styles.groupCard}>
      <View style={styles.groupItem}>
        <View style={styles.itemLeft}>
          <View style={styles.itemIconBox}>
            <MaterialIcons name="psychology" size={18} color={tokens.colors.primary} />
          </View>
          <View style={styles.itemTextCol}>
            <Text style={styles.itemTitle}>Modelo Ativo</Text>
            <Text style={styles.itemSub}>Gemini 2.5 Flash / Groq Cloud</Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={18} color={tokens.colors.outline} />
      </View>

      <View style={styles.divider} />

      <View style={styles.groupItem}>
        <View style={styles.itemLeft}>
          <View style={styles.itemIconBox}>
            <MaterialIcons name="bolt" size={18} color={tokens.colors.tertiary} />
          </View>
          <View style={styles.itemTextCol}>
            <Text style={styles.itemTitle}>Modo de Resposta</Text>
            <Text style={styles.itemSub}>Ultra Conciso & Executivo</Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={18} color={tokens.colors.outline} />
      </View>

      <View style={styles.divider} />

      <View style={styles.groupItem}>
        <View style={styles.itemLeft}>
          <View style={styles.itemIconBox}>
            <MaterialIcons name="calendar-today" size={18} color={tokens.colors.secondary} />
          </View>
          <View style={styles.itemTextCol}>
            <Text style={styles.itemTitle}>Sincronização de Calendários</Text>
            <Text style={styles.itemSub}>Google Calendar + Apple iCloud</Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={18} color={tokens.colors.outline} />
      </View>

      <View style={styles.divider} />

      <View style={styles.groupItem}>
        <View style={styles.itemLeft}>
          <View style={styles.itemIconBox}>
            <MaterialIcons name="mic" size={18} color={tokens.colors.textSecondary} />
          </View>
          <View style={styles.itemTextCol}>
            <Text style={styles.itemTitle}>Transcrições de Reuniões</Text>
            <Text style={styles.itemSub}>Whisper local via RPi</Text>
          </View>
        </View>
        <Switch
          value={whisperEnabled}
          onValueChange={setWhisperEnabled}
          trackColor={{ false: tokens.colors.surfaceContainerHighest, true: tokens.colors.primaryContainer }}
          thumbColor={whisperEnabled ? tokens.colors.primary : tokens.colors.outline}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  groupCard: {
    backgroundColor: tokens.colors.surfaceContainer,
    borderRadius: tokens.radii.lg,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    overflow: 'hidden',
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.md,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
  },
  itemIconBox: {
    width: 32,
    height: 32,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextCol: {
    flex: 1,
  },
  itemTitle: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
  },
  itemSub: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.size.xs,
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginHorizontal: tokens.spacing.md,
  },
});
