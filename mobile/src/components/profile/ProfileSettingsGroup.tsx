import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { M3Switch } from '../ui/M3Switch';

interface ProfileSettingsGroupProps {
  onOpenNotifications?: () => void;
  onOpenCalendarSync?: () => void;
}

export const ProfileSettingsGroup: React.FC<ProfileSettingsGroupProps> = ({
  onOpenNotifications,
  onOpenCalendarSync,
}) => {
  const { colors, isDark, toggleTheme } = useTheme();

  return (
    <View style={[styles.groupCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
      {/* Alternador de Tema M3 */}
      <TouchableOpacity
        style={styles.groupItem}
        onPress={toggleTheme}
        activeOpacity={0.7}
      >
        <View style={styles.itemLeft}>
          <View style={[styles.itemIconBox, { backgroundColor: colors.surfaceContainerHigh }]}>
            <MaterialIcons
              name={isDark ? 'dark-mode' : 'light-mode'}
              size={18}
              color={colors.primary}
            />
          </View>
          <View style={styles.itemTextCol}>
            <Text style={[styles.itemTitle, { color: colors.onSurface }]}>Tema da Interface</Text>
            <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
              {isDark ? 'Tema Escuro (M3 Dark)' : 'Tema Claro (M3 Light)'}
            </Text>
          </View>
        </View>
        <M3Switch
          value={isDark}
          onValueChange={toggleTheme}
        />
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

      {/* Notificações */}
      <TouchableOpacity
        style={styles.groupItem}
        onPress={onOpenNotifications}
        activeOpacity={0.7}
      >
        <View style={styles.itemLeft}>
          <View style={[styles.itemIconBox, { backgroundColor: colors.surfaceContainerHigh }]}>
            <MaterialIcons name="notifications-active" size={18} color={colors.primary} />
          </View>
          <View style={styles.itemTextCol}>
            <Text style={[styles.itemTitle, { color: colors.onSurface }]}>Notificações</Text>
            <Text style={[styles.itemSub, { color: colors.onSurfaceVariant }]}>Lembretes e avisos</Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={18} color={colors.outline} />
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

      {/* Sincronização de Calendários */}
      <TouchableOpacity
        style={styles.groupItem}
        onPress={onOpenCalendarSync}
        activeOpacity={0.7}
      >
        <View style={styles.itemLeft}>
          <View style={[styles.itemIconBox, { backgroundColor: colors.surfaceContainerHigh }]}>
            <MaterialIcons name="calendar-today" size={18} color={colors.primary} />
          </View>
          <View style={styles.itemTextCol}>
            <Text style={[styles.itemTitle, { color: colors.onSurface }]}>Sincronização de Calendários</Text>
            <Text style={[styles.itemSub, { color: colors.onSurfaceVariant }]}>Google Calendar</Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={18} color={colors.outline} />
      </TouchableOpacity>
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
    backgroundColor: tokens.colors.outlineVariant,
    marginHorizontal: tokens.spacing.md,
  },
});
