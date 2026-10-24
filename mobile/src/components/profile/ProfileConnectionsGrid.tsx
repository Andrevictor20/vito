import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';

interface ProfileConnectionsGridProps {
  onPressCalendar: () => void;
  onPressGmail: () => void;
  onPressWhatsApp: () => void;
  calendarActive?: boolean;
  gmailActive?: boolean;
  whatsAppActive?: boolean;
}

export const ProfileConnectionsGrid: React.FC<ProfileConnectionsGridProps> = ({
  onPressCalendar,
  onPressGmail,
  onPressWhatsApp,
  calendarActive = true,
  gmailActive = false,
  whatsAppActive = false,
}) => {
  const { colors } = useTheme();

  const connections = [
    {
      id: 'calendar',
      name: 'Google Agenda',
      icon: 'calendar-month' as const,
      color: colors.blue,
      bgColor: colors.blueBg,
      active: calendarActive,
      onPress: onPressCalendar,
    },
    {
      id: 'gmail',
      name: 'Gmail',
      icon: 'mail' as const,
      color: colors.red,
      bgColor: colors.redBg,
      active: gmailActive,
      onPress: onPressGmail,
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: 'chat' as const,
      color: colors.acc,
      bgColor: colors.greenBg,
      active: whatsAppActive,
      onPress: onPressWhatsApp,
    },
  ];

  return (
    <View style={styles.grid}>
      {connections.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[styles.tile, { backgroundColor: colors.bg, borderColor: colors.line }]}
          onPress={() => {
            hapticFeedback.selection();
            item.onPress();
          }}
          activeOpacity={0.75}
          accessibilityLabel={`${item.name}, status: ${item.active ? 'Ativo' : 'Conectar'}`}
        >
          {/* Chip com ícone */}
          <View style={[styles.chip, { backgroundColor: item.bgColor }]}>
            <MaterialIcons name={item.icon} size={18} color={item.color} />
          </View>

          {/* Nome da Conexão */}
          <Text style={[styles.tileName, { color: colors.ink }]} numberOfLines={1}>
            {item.name}
          </Text>

          {/* Indicador de Status */}
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: item.active ? colors.acc : colors.muted },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: item.active ? colors.acc : colors.muted },
              ]}
            >
              {item.active ? 'Ativo' : 'Conectar'}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  tile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  tileName: {
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: tokens.typography.family.medium,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
});
